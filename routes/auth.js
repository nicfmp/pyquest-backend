import { Router } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { pool } from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { QUEST_IDS } from '../constants.js';

const router = Router();
const SALT_ROUNDS = 10;

function validarEmail(email) {
  return email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function validarSenha(senha) {
  return senha && senha.length >= 6;
}

function validarUsername(username) {
  // letras, números e underscore, 3 a 20 caracteres
  return username && /^[a-zA-Z0-9_]{3,20}$/.test(username);
}

function validarDataNascimento(data) {
  if (!data || !/^\d{4}-\d{2}-\d{2}$/.test(data)) return false;
  const parsed = new Date(data);
  if (Number.isNaN(parsed.getTime())) return false;
  return parsed.getTime() < Date.now(); // não pode ser no futuro
}

function buildProgressMap(rows) {
  return rows.reduce((acc, row) => {
    acc[row.quest_id] = { completedChallenges: row.completed_challenges, xp: row.xp };
    return acc;
  }, {});
}

function formatUsuario(user) {
  return {
    id: user.id,
    email: user.email,
    username: user.username,
    created_at: user.created_at,
  };
}

router.post('/register', async (req, res) => {
  const { email, username, senha, dataNascimento } = req.body;

  if (!validarEmail(email)) return res.status(400).json({ erro: 'E-mail inválido.' });
  if (!validarUsername(username)) {
    return res.status(400).json({
      erro: 'Nome de usuário precisa ter de 3 a 20 caracteres (letras, números ou _).',
    });
  }
  if (!validarSenha(senha)) {
    return res.status(400).json({ erro: 'A senha precisa ter pelo menos 6 caracteres.' });
  }
  if (!validarDataNascimento(dataNascimento)) {
    return res.status(400).json({ erro: 'Informe uma data de nascimento válida.' });
  }

  const emailNormalizado = email.toLowerCase();

  const emailExistente = await pool.query('SELECT id FROM users WHERE email = $1', [emailNormalizado]);
  if (emailExistente.rows.length > 0) {
    return res.status(409).json({ erro: 'Já existe uma conta com esse e-mail.' });
  }

  const usernameExistente = await pool.query('SELECT id FROM users WHERE username = $1', [username]);
  if (usernameExistente.rows.length > 0) {
    return res.status(409).json({ erro: 'Esse nome de usuário já está em uso.' });
  }

  const senhaHash = await bcrypt.hash(senha, SALT_ROUNDS);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const userResult = await client.query(
      `INSERT INTO users (email, username, senha_hash, data_nascimento)
       VALUES ($1, $2, $3, $4)
       RETURNING id, email, username`,
      [emailNormalizado, username, senhaHash, dataNascimento]
    );
    const user = userResult.rows[0];

    for (const questId of QUEST_IDS) {
      await client.query(
        'INSERT INTO progress (user_id, quest_id, completed_challenges, xp) VALUES ($1, $2, 0, 0)',
        [user.id, questId]
      );
    }

    await client.query('COMMIT');
    return res.status(201).json({ id: user.id, email: user.email, username: user.username });
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
});

router.post('/login', async (req, res) => {
  const { email, senha } = req.body;
  if (!validarEmail(email)) return res.status(400).json({ erro: 'E-mail inválido.' });
  if (!validarSenha(senha)) return res.status(400).json({ erro: 'Senha inválida.' });

  const result = await pool.query('SELECT * FROM users WHERE email = $1', [email.toLowerCase()]);
  const user = result.rows[0];
  if (!user) return res.status(401).json({ erro: 'E-mail ou senha incorretos.' });

  const senhaConfere = await bcrypt.compare(senha, user.senha_hash);
  if (!senhaConfere) return res.status(401).json({ erro: 'E-mail ou senha incorretos.' });

  const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, { expiresIn: '7d' });

  const progressResult = await pool.query(
    'SELECT quest_id, completed_challenges, xp FROM progress WHERE user_id = $1',
    [user.id]
  );

  return res.json({
    token,
    usuario: formatUsuario(user),
    progress: buildProgressMap(progressResult.rows),
  });
});

router.get('/me', requireAuth, async (req, res) => {
  const userResult = await pool.query(
    'SELECT id, email, username, created_at FROM users WHERE id = $1',
    [req.userId]
  );
  const user = userResult.rows[0];
  if (!user) return res.status(404).json({ erro: 'Usuário não encontrado.' });

  const progressResult = await pool.query(
    'SELECT quest_id, completed_challenges, xp FROM progress WHERE user_id = $1',
    [req.userId]
  );

  return res.json({
    usuario: formatUsuario(user),
    progress: buildProgressMap(progressResult.rows),
  });
});

// POST /api/reset-password — redefine a senha confirmando e-mail + data de nascimento.
// Simplificação proposital para o escopo do projeto: sem envio de e-mail.
// Em produção, o ideal seria um link de redefinição enviado por e-mail com token de uso único.
router.post('/reset-password', async (req, res) => {
  const { email, dataNascimento, novaSenha } = req.body;

  if (!validarEmail(email) || !validarDataNascimento(dataNascimento)) {
    return res.status(400).json({ erro: 'Informe um e-mail e uma data de nascimento válidos.' });
  }
  if (!validarSenha(novaSenha)) {
    return res.status(400).json({ erro: 'A nova senha precisa ter pelo menos 6 caracteres.' });
  }

  const genericError = { erro: 'Não foi possível redefinir a senha com esses dados.' };

  const result = await pool.query(
    'SELECT id, data_nascimento FROM users WHERE email = $1',
    [email.toLowerCase()]
  );
  const user = result.rows[0];

  // Mensagem genérica de propósito: não revela se o e-mail existe ou não.
  if (!user || !user.data_nascimento) return res.status(400).json(genericError);

  const dataArmazenada = user.data_nascimento.toISOString().slice(0, 10);
  if (dataArmazenada !== dataNascimento) return res.status(400).json(genericError);

  const novaSenhaHash = await bcrypt.hash(novaSenha, SALT_ROUNDS);
  await pool.query('UPDATE users SET senha_hash = $1 WHERE id = $2', [novaSenhaHash, user.id]);

  return res.json({ ok: true });
});

export default router;
