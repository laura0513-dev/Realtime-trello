import { Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import {
  createColumnSchema,
  updateColumnSchema,
  reorderColumnSchema,
} from './columns.schemas';
import * as columnsService from './columns.service';
import type { AuthRequest } from '../../middlewares/auth';

function handleZod(error: unknown, res: Response, next: NextFunction): void {
  if (error instanceof ZodError) {
    res.status(400).json({ errors: error.issues.map((e) => e.message) });
    return;
  }
  next(error);
}

export async function createColumn(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const input = createColumnSchema.parse(req.body);
    const column = await columnsService.createColumn(
      req.params.boardId,
      req.user!.id,
      input,
    );
    res.status(201).json(column);
  } catch (error) {
    handleZod(error, res, next);
  }
}

export async function updateColumn(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const input = updateColumnSchema.parse(req.body);
    const column = await columnsService.updateColumn(
      req.params.id,
      req.user!.id,
      input,
    );
    res.status(200).json(column);
  } catch (error) {
    handleZod(error, res, next);
  }
}

export async function reorderColumn(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const input = reorderColumnSchema.parse(req.body);
    const column = await columnsService.reorderColumn(
      req.params.id,
      req.user!.id,
      input,
    );
    res.status(200).json(column);
  } catch (error) {
    handleZod(error, res, next);
  }
}

export async function deleteColumn(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    await columnsService.deleteColumn(req.params.id, req.user!.id);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
}
