import { Router } from 'express';
import { pool } from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { QUEST_TOTALS, XP_PER_CHALLENGE } from '../constants.js';

const router = Router();

function buildProgressMap(rows) {
  return rows.reduce((acc, row) => {
    acc[row.quest_id] = { completedChallenges: row.completed_challenges, xp: row.xp };
    return acc;
  }, {});
}

router.post('/progress/complete', requireAuth, async (req, res) => {
  const questId = Number(req.body.questId);

  if (!QUEST_TOTALS[questId]) {
    return res.status(400).json({ erro: 'Quest inválida.' });
  }

  const current = await pool.query(
    'SELECT completed_challenges FROM progress WHERE user_id = $1 AND quest_id = $2',
    [req.userId, questId]
  );

  if (current.rows.length === 0) {
    return res.status(400).json({ erro: 'Quest inválida.' });
  }

  if (current.rows[0].completed_challenges < QUEST_TOTALS[questId]) {
    await pool.query(
      `UPDATE progress
       SET completed_challenges = completed_challenges + 1, xp = xp + $1
       WHERE user_id = $2 AND quest_id = $3`,
      [XP_PER_CHALLENGE, req.userId, questId]
    );
  }

  const progressResult = await pool.query(
    'SELECT quest_id, completed_challenges, xp FROM progress WHERE user_id = $1',
    [req.userId]
  );

  return res.json({ progress: buildProgressMap(progressResult.rows) });
});

export default router;
