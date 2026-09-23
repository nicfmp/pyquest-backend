import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { initDB } from './db.js';
import authRoutes from './routes/auth.js';
import progressRoutes from './routes/progress.js';
import gameProgressRoutes from './routes/gameProgress.js';

const app = express();

app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:5173' }));
app.use(express.json());

app.use('/api', authRoutes);
app.use('/api', progressRoutes);
app.use('/api', gameProgressRoutes);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

const PORT = process.env.PORT || 4000;

initDB()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Servidor rodando em http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error('Não foi possível conectar ao Postgres:', err.message);
    process.exit(1);
  });
