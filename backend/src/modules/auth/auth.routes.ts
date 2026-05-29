import { Router } from 'express';
import { register, login, me } from './auth.controller';
import { authenticate } from '../../middlewares/auth';

export const authRouter = Router();

// Rutas públicas (no requieren token)
authRouter.post('/register', register);
authRouter.post('/login', login);

// Ruta protegida: authenticate verifica el JWT antes de llegar al controller
authRouter.get('/me', authenticate, me);
