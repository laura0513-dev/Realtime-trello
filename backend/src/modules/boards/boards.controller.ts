import { Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { createBoardSchema, updateBoardSchema } from './boards.schemas';
import * as boardsService from './boards.service';
import type { AuthRequest } from '../../middlewares/auth';

export async function createBoard(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const input = createBoardSchema.parse(req.body);
    const board = await boardsService.createBoard(req.user!.id, input);
    res.status(201).json(board);
  } catch (error) {
    if (error instanceof ZodError) {
      res.status(400).json({ errors: error.issues.map((e) => e.message) });
      return;
    }
    next(error);
  }
}

export async function getBoards(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const boards = await boardsService.getBoards(req.user!.id);
    res.status(200).json(boards);
  } catch (error) {
    next(error);
  }
}

export async function getBoardById(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const board = await boardsService.getBoardById(req.params.id, req.user!.id);
    res.status(200).json(board);
  } catch (error) {
    next(error);
  }
}

export async function updateBoard(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const input = updateBoardSchema.parse(req.body);
    const board = await boardsService.updateBoard(req.params.id, req.user!.id, input);
    res.status(200).json(board);
  } catch (error) {
    if (error instanceof ZodError) {
      res.status(400).json({ errors: error.issues.map((e) => e.message) });
      return;
    }
    next(error);
  }
}

export async function deleteBoard(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    await boardsService.deleteBoard(req.params.id, req.user!.id);
    // 204 No Content: operación exitosa, sin cuerpo de respuesta
    res.status(204).send();
  } catch (error) {
    next(error);
  }
}
