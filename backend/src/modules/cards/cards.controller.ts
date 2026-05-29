import { Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { createCardSchema, updateCardSchema, moveCardSchema } from './cards.schemas';
import * as cardsService from './cards.service';
import type { AuthRequest } from '../../middlewares/auth';
import { getIO } from '../../sockets';

function handleZod(error: unknown, res: Response, next: NextFunction): void {
  if (error instanceof ZodError) {
    res.status(400).json({ errors: error.issues.map((e) => e.message) });
    return;
  }
  next(error);
}

export async function createCard(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const input = createCardSchema.parse(req.body);
    const { card, boardId } = await cardsService.createCard(req.params.columnId, req.user!.id, input);
    getIO().to(`board:${boardId}`).emit('card:created', card);
    res.status(201).json(card);
  } catch (error) {
    handleZod(error, res, next);
  }
}

export async function updateCard(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const input = updateCardSchema.parse(req.body);
    const { card, boardId } = await cardsService.updateCard(req.params.id, req.user!.id, input);
    getIO().to(`board:${boardId}`).emit('card:updated', card);
    res.status(200).json(card);
  } catch (error) {
    handleZod(error, res, next);
  }
}

export async function moveCard(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const input = moveCardSchema.parse(req.body);
    const { card, boardId } = await cardsService.moveCard(req.params.id, req.user!.id, input);
    getIO().to(`board:${boardId}`).emit('card:moved', card);
    res.status(200).json(card);
  } catch (error) {
    handleZod(error, res, next);
  }
}

export async function deleteCard(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { cardId, boardId } = await cardsService.deleteCard(req.params.id, req.user!.id);
    getIO().to(`board:${boardId}`).emit('card:deleted', { id: cardId });
    res.status(204).send();
  } catch (error) {
    next(error);
  }
}
