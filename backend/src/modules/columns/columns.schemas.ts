import { z } from 'zod';

const hexColor = z
  .string()
  .regex(/^#[0-9A-Fa-f]{6}$/, 'Color must be a valid hex code (e.g. #6366f1)')
  .optional();

export const createColumnSchema = z.object({
  title:    z.string().min(1, 'Title is required').max(50, 'Title too long'),
  type:     z.enum(['BACKLOG', 'ACTIVE', 'DONE']).optional(),
  color:    hexColor,
});

export const updateColumnSchema = z.object({
  title:    z.string().min(1, 'Title is required').max(50, 'Title too long').optional(),
  type:     z.enum(['BACKLOG', 'ACTIVE', 'DONE']).optional(),
  color:    hexColor,
});

// Para reordenar solo se envía la nueva posición
export const reorderColumnSchema = z.object({
  position: z.number().int().min(0, 'Position must be a non-negative integer'),
});

export type CreateColumnInput  = z.infer<typeof createColumnSchema>;
export type UpdateColumnInput  = z.infer<typeof updateColumnSchema>;
export type ReorderColumnInput = z.infer<typeof reorderColumnSchema>;
