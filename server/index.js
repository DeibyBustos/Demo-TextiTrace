import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { router as apiRouter } from './routes.js';
import { exportRouter } from './export.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

app.use(express.json());
app.use('/api', exportRouter);
app.use('/api', apiRouter);

// Servir el build de React (un solo servicio -> un solo link público, sin CORS)
const clientDist = path.join(__dirname, '..', 'client', 'dist');
app.use(express.static(clientDist));
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) return next();
  res.sendFile(path.join(clientDist, 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`TextiTrace corriendo en http://localhost:${PORT}`);
});
