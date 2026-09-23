import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { pool } from '../db.js';

const router = Router();

// Limite de segurança para o tamanho do estado salvo (o estado real do jogo
// é pequeno — poucos KB — isso só evita abuso da rota).
const MAX_STATE_BYTES = 200_000;

// Igual ao requireAuth de middleware/auth.js, mas também aceita o token via
// query string (?token=...). Isso é necessário porque o jogo usa
// navigator.sendBeacon para tentar salvar o progresso quando a aba é fechada,
// e sendBeacon não permite enviar o header Authorization.
function requireAuthFlexible(req, res, next) {
  const authHeader = req.headers.authorization;
  const token =
    authHeader && authHeader.startsWith('Bearer ')
      ? authHeader.split(' ')[1]
      : req.query.token;

  if (!token) {
    return res.status(401).json({ erro: 'Token não informado.' });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.userId = payload.userId;
    next();
  } catch (err) {
    return res.status(401).json({ erro: 'Token inválido ou expirado.' });
  }
}

router.get('/game-progress', requireAuthFlexible, async (req, res) => {
  const result = await pool.query(
    'SELECT state, updated_at FROM game_progress WHERE user_id = $1',
    [req.userId]
  );

  if (result.rows.length === 0) {
    return res.json({ state: null, updatedAt: null });
  }

  return res.json({ state: result.rows[0].state, updatedAt: result.rows[0].updated_at });
});

async function saveState(req, res) {
  const { state } = req.body;

  if (state === undefined || state === null || typeof state !== 'object') {
    return res.status(400).json({ erro: 'Estado do jogo inválido.' });
  }

  const serialized = JSON.stringify(state);
  if (Buffer.byteLength(serialized, 'utf8') > MAX_STATE_BYTES) {
    return res.status(413).json({ erro: 'Estado do jogo grande demais.' });
  }

  await pool.query(
    `INSERT INTO game_progress (user_id, state, updated_at)
     VALUES ($1, $2::jsonb, now())
     ON CONFLICT (user_id) DO UPDATE SET state = $2::jsonb, updated_at = now()`,
    [req.userId, serialized]
  );

  return res.json({ ok: true });
}

router.put('/game-progress', requireAuthFlexible, saveState);
// sendBeacon só envia POST — aceitamos as duas verbas na mesma rota.
router.post('/game-progress', requireAuthFlexible, saveState);

export default router;
