import { Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { createCardSchema, updateCardSchema, moveCardSchema } from './cards.schemas';
import * as cardsService from './cards.service';
import type { AuthRequest } from '../../middlewares/auth';

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
    const card  = await cardsService.createCard(req.params.columnId, req.user!.id, input);
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
    const card  = await cardsService.updateCard(req.params.id, req.user!.id, input);
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
    const card  = await cardsService.moveCard(req.params.id, req.user!.id, input);
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
    await cardsService.deleteCard(req.params.id, req.user!.id);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
}
