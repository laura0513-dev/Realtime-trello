import { Router } from 'express';
import { authenticate } from '../../middlewares/auth';
import {
  createColumn,
  updateColumn,
  reorderColumn,
  deleteColumn,
} from './columns.controller';

export const columnsRouter = Router({ mergeParams: true });

// mergeParams: true permite acceder a :boardId definido en el router padre
// (cuando la ruta es POST /api/boards/:boardId/columns)
columnsRouter.use(authenticate);

columnsRouter.post('/',                createColumn);   // POST   /api/boards/:boardId/columns
columnsRouter.patch('/:id',            updateColumn);   // PATCH  /api/columns/:id
columnsRouter.patch('/:id/position',   reorderColumn);  // PATCH  /api/columns/:id/position
columnsRouter.delete('/:id',           deleteColumn);   // DELETE /api/columns/:id
