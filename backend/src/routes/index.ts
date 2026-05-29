import { Router } from 'express';
import { authRouter } from '../modules/auth/auth.routes';

// Router raíz que agrupa todas las rutas de la API.
// Cada módulo (auth, boards, columns, cards) tendrá su propio archivo
// de rutas, lo que facilita crecer sin tocar este archivo.
export const router = Router();

// Health check: permite verificar que el servidor está activo
// sin necesidad de autenticación (útil para Docker y CI/CD)
router.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

router.use('/auth', authRouter);

// Las rutas de cada módulo se irán añadiendo aquí:
// router.use('/boards', boardRoutes);
// router.use('/columns', columnRoutes);
// router.use('/cards', cardRoutes);
