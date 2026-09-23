import { Router } from 'express';
import { pool } from '../db.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

// Limite de segurança para o tamanho do estado salvo (o estado real do jogo
// é pequeno — poucos KB — isso só evita abuso da rota).
const MAX_STATE_BYTES = 200_000;

router.get('/game-progress', requireAuth, async (req, res) => {
  const result = await pool.query(
    'SELECT state, updated_at FROM game_progress WHERE user_id = $1',
    [req.userId]
  );

  if (result.rows.length === 0) {
    return res.json({ state: null, updatedAt: null });
  }

  return res.json({ state: result.rows[0].state, updatedAt: result.rows[0].updated_at });
});

router.put('/game-progress', requireAuth, async (req, res) => {
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
});

export default router;
