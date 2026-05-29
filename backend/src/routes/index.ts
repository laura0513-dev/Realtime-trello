import { Router } from 'express';
import { authRouter } from '../modules/auth/auth.routes';
import { boardsRouter } from '../modules/boards/boards.routes';
import { columnsRouter } from '../modules/columns/columns.routes';

// Router raíz que agrupa todas las rutas de la API.
// Cada módulo (auth, boards, columns, cards) tendrá su propio archivo
// de rutas, lo que facilita crecer sin tocar este archivo.
export const router = Router();

// Health check: permite verificar que el servidor está activo
// sin necesidad de autenticación (útil para Docker y CI/CD)
router.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

router.use('/auth',                        authRouter);
router.use('/boards',                      boardsRouter);
router.use('/boards/:boardId/columns',     columnsRouter);  // POST crear columna
router.use('/columns',                     columnsRouter);  // PATCH/DELETE columna

// Las rutas de cada módulo se irán añadiendo aquí:
// router.use('/cards', cardRoutes);
