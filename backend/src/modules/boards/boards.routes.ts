import { Router } from 'express';
import { authenticate } from '../../middlewares/auth';
import {
  createBoard,
  getBoards,
  getBoardById,
  updateBoard,
  deleteBoard,
} from './boards.controller';

export const boardsRouter = Router();

// Todas las rutas de tableros requieren autenticación
boardsRouter.use(authenticate);

boardsRouter.post('/',     createBoard);
boardsRouter.get('/',      getBoards);
boardsRouter.get('/:id',   getBoardById);
boardsRouter.patch('/:id', updateBoard);
boardsRouter.delete('/:id',deleteBoard);
