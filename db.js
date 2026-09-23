import pg from 'pg';

const { Pool } = pg;

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('render.com')
    ? { rejectUnauthorized: false }
    : false,
});

export async function initDB() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      senha_hash TEXT NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT now()
    )
  `);

  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS username TEXT`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS data_nascimento DATE`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS aceitou_termos_em TIMESTAMP`);
  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS users_username_unique ON users (username)
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS progress (
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      quest_id INTEGER NOT NULL,
      completed_challenges INTEGER NOT NULL DEFAULT 0,
      xp INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (user_id, quest_id)
    )
  `);

  // Progresso do jogo Pyton Knight (Phaser) — guarda o mesmo objeto de estado
  // que o PersistenceService.js do jogo já usa no localStorage, agora também
  // persistido por conta no backend.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS game_progress (
      user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      state JSONB NOT NULL DEFAULT '{}'::jsonb,
      updated_at TIMESTAMP NOT NULL DEFAULT now()
    )
  `);
}
