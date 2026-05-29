import { z } from 'zod';

export const createCardSchema = z.object({
  title:       z.string().min(1, 'Title is required').max(200, 'Title too long'),
  description: z.string().max(2000, 'Description too long').optional(),
});

export const updateCardSchema = z.object({
  title:       z.string().min(1, 'Title is required').max(200, 'Title too long').optional(),
  description: z.string().max(2000, 'Description too long').nullable().optional(),
});

// Mover una card implica cambiar de columna y/o de posición dentro de ella
export const moveCardSchema = z.object({
  columnId: z.string().min(1, 'Target column is required'),
  position: z.number().int().min(0, 'Position must be a non-negative integer'),
});

export type CreateCardInput = z.infer<typeof createCardSchema>;
export type UpdateCardInput = z.infer<typeof updateCardSchema>;
export type MoveCardInput   = z.infer<typeof moveCardSchema>;
