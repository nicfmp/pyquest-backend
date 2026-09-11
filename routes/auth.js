import { Router } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { pool } from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { QUEST_IDS } from '../constants.js';

const router = Router();
const SALT_ROUNDS = 10;

function validarEmailSenha(email, senha) {
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return 'E-mail inválido.';
  }
  if (!senha || senha.length < 6) {
    return 'A senha precisa ter pelo menos 6 caracteres.';
  }
  return null;
}

function buildProgressMap(rows) {
  return rows.reduce((acc, row) => {
    acc[row.quest_id] = { completedChallenges: row.completed_challenges, xp: row.xp };
    return acc;
  }, {});
}

router.post('/register', async (req, res) => {
  const { email, senha } = req.body;
  const erroValidacao = validarEmailSenha(email, senha);
  if (erroValidacao) return res.status(400).json({ erro: erroValidacao });

  const emailNormalizado = email.toLowerCase();

  const existente = await pool.query('SELECT id FROM users WHERE email = $1', [emailNormalizado]);
  if (existente.rows.length > 0) {
    return res.status(409).json({ erro: 'Já existe uma conta com esse e-mail.' });
  }

  const senhaHash = await bcrypt.hash(senha, SALT_ROUNDS);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const userResult = await client.query(
      'INSERT INTO users (email, senha_hash) VALUES ($1, $2) RETURNING id, email',
      [emailNormalizado, senhaHash]
    );
    const user = userResult.rows[0];

    for (const questId of QUEST_IDS) {
      await client.query(
        'INSERT INTO progress (user_id, quest_id, completed_challenges, xp) VALUES ($1, $2, 0, 0)',
        [user.id, questId]
      );
    }

    await client.query('COMMIT');
    return res.status(201).json({ id: user.id, email: user.email });
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
});

router.post('/login', async (req, res) => {
  const { email, senha } = req.body;
  const erroValidacao = validarEmailSenha(email, senha);
  if (erroValidacao) return res.status(400).json({ erro: erroValidacao });

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
    usuario: { id: user.id, email: user.email },
    progress: buildProgressMap(progressResult.rows),
  });
});

router.get('/me', requireAuth, async (req, res) => {
  const userResult = await pool.query(
    'SELECT id, email, created_at FROM users WHERE id = $1',
    [req.userId]
  );
  const user = userResult.rows[0];
  if (!user) return res.status(404).json({ erro: 'Usuário não encontrado.' });

  const progressResult = await pool.query(
    'SELECT quest_id, completed_challenges, xp FROM progress WHERE user_id = $1',
    [req.userId]
  );

  return res.json({
    usuario: { id: user.id, email: user.email, created_at: user.created_at },
    progress: buildProgressMap(progressResult.rows),
  });
});

export default router;
