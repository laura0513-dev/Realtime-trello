import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { env } from './config/env';
import { router } from './routes';
import { errorHandler } from './middlewares/errorHandler';

const app = express();

// --- Middlewares de seguridad ---
// helmet agrega cabeceras HTTP de seguridad (XSS, clickjacking, etc.)
app.use(helmet());

// cors controla qué orígenes pueden hacer peticiones al backend
app.use(cors({ origin: env.CLIENT_URL }));

// Permite recibir JSON en el body de las peticiones
app.use(express.json());

// --- Rutas ---
app.use('/api', router);

// --- Manejo global de errores ---
// Debe ir al final, después de todas las rutas
app.use(errorHandler);

export default app;
