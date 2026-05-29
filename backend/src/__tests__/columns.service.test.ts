/**
 * Tests unitarios para columns.service.ts
 *
 * ─── APIS DE VITEST NUEVAS EN ESTE ARCHIVO ───────────────────────────────────
 *
 * toHaveBeenNthCalledWith(n, args)
 *   Verifica los argumentos de la N-ésima llamada de un mock.
 *   Útil cuando un mock se llama varias veces con argumentos distintos
 *   (por ejemplo, updateMany para reordenar posiciones).
 *
 * toHaveBeenCalledTimes(n)
 *   Número exacto de invocaciones. Confirma que no se hicieron llamadas
 *   adicionales inesperadas a la BD.
 *
 * expect.any(Constructor)
 *   Matcher que acepta cualquier valor que sea instancia de Constructor.
 *   Ej: expect.any(String) pasa para cualquier string.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mockDeep, mockReset } from 'vitest-mock-extended';
import type { PrismaClient } from '@prisma/client';

// ─── MOCKS ────────────────────────────────────────────────────────────────────

vi.mock('../config/database', () => ({
  prisma: mockDeep<PrismaClient>(),
}));

// ─── IMPORTACIONES ────────────────────────────────────────────────────────────

import {
  createColumn,
  reorderColumn,
  deleteColumn,
} from '../modules/columns/columns.service';
import { prisma } from '../config/database';
import { AppError } from '../middlewares/errorHandler';

type MockPrisma = ReturnType<typeof mockDeep<PrismaClient>>;
const db = prisma as unknown as MockPrisma;

// ─── HELPERS ──────────────────────────────────────────────────────────────────

/** Crea un mock de columna con board anidado para assertColumnOwnership */
const makeColumnWithBoard = (overrides: { position?: number; ownerId?: string; id?: string; boardId?: string } = {}) => ({
  id: overrides.id ?? 'col-3',
  title: 'Test Column',
  position: overrides.position ?? 2,
  type: 'ACTIVE',
  color: null,
  boardId: overrides.boardId ?? 'board-1',
  createdAt: new Date(),
  updatedAt: new Date(),
  board: {
    id: overrides.boardId ?? 'board-1',
    title: 'Mi Tablero',
    ownerId: overrides.ownerId ?? 'user-1',
    createdAt: new Date(),
    updatedAt: new Date(),
  },
});

/** Mock de tablero para assertBoardOwnership */
const makeBoardForOwnership = (ownerId = 'user-1') => ({
  id: 'board-1',
  title: 'Mi Tablero',
  ownerId,
  createdAt: new Date(),
  updatedAt: new Date(),
});

// ─────────────────────────────────────────────────────────────────────────────

describe('Columns Service', () => {
  beforeEach(() => {
    mockReset(db);
    // Prisma updateMany y delete retornan objetos con count. Configuramos
    // valores por defecto para que los tests no fallen por valor undefined.
    db.column.updateMany.mockResolvedValue({ count: 0 } as any);
    db.column.delete.mockResolvedValue({} as any);
  });

  // ─── CREATE COLUMN ──────────────────────────────────────────────────────────

  describe('createColumn()', () => {
    /**
     * C1 — Nueva columna se añade al final (position = lastColumn.position + 1)
     * El servicio busca la última columna del tablero con findFirst ordenado por
     * position desc. Si la última está en posición 2, la nueva va en posición 3.
     */
    it('C1 - asigna position = lastColumn.position + 1 a la nueva columna', async () => {
      // Arrange: el tablero pertenece al usuario (assertBoardOwnership pasa)
      db.board.findUnique.mockResolvedValue(makeBoardForOwnership() as any);

      // Arrange: la última columna existente está en posición 2
      db.column.findFirst.mockResolvedValue({ position: 2 } as any);

      // Arrange: Prisma crea la columna y la retorna
      const newColumn = {
        id: 'col-new',
        title: 'Nueva Columna',
        position: 3,
        type: 'ACTIVE',
        color: null,
        boardId: 'board-1',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      db.column.create.mockResolvedValue(newColumn as any);

      // Act
      const result = await createColumn('board-1', 'user-1', { title: 'Nueva Columna' });

      // Assert: la columna creada tiene posición 3 (2+1)
      expect(result.column.position).toBe(3);

      // Assert: Prisma fue llamado con data.position = 3
      expect(db.column.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ position: 3, boardId: 'board-1' }),
        }),
      );
    });
  });

  // ─── REORDER COLUMN ─────────────────────────────────────────────────────────

  describe('reorderColumn()', () => {
    /**
     * C2 — Mover columna hacia arriba (posición 3 → 1)
     * Las columnas en posiciones 1 y 2 deben incrementar su posición (bajar un hueco).
     * Condición: newPosition < oldPosition → updateMany con { gte: new, lt: old } + increment
     */
    it('C2 - mover columna hacia arriba incrementa posiciones de las columnas intermedias', async () => {
      // Arrange: la columna está actualmente en posición 3
      db.column.findUnique.mockResolvedValue(makeColumnWithBoard({ position: 3, id: 'col-3' }) as any);

      // Arrange: la columna actualizada que retorna column.update
      db.column.update.mockResolvedValue({ ...makeColumnWithBoard({ position: 1 }) } as any);

      // Act: movemos la columna de posición 3 a posición 1
      await reorderColumn('col-3', 'user-1', { position: 1 });

      // Assert: updateMany desplaza hacia abajo las columnas en posiciones 1 y 2
      // { gte: newPos(1), lt: oldPos(3) } = posiciones 1, 2 → incrementan
      expect(db.column.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            boardId: 'board-1',
            position: { gte: 1, lt: 3 },
          }),
          data: { position: { increment: 1 } },
        }),
      );

      // Assert: la columna movida recibe la posición destino
      expect(db.column.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'col-3' },
          data: expect.objectContaining({ position: 1 }),
        }),
      );
    });

    /**
     * C3 — Mover columna hacia abajo (posición 0 → 2)
     * Las columnas en posiciones 1 y 2 deben decrementar su posición (subir un hueco).
     * Condición: newPosition > oldPosition → updateMany con { gt: old, lte: new } + decrement
     */
    it('C3 - mover columna hacia abajo decrementa posiciones de las columnas intermedias', async () => {
      // Arrange: la columna está en posición 0
      db.column.findUnique.mockResolvedValue(makeColumnWithBoard({ position: 0, id: 'col-0' }) as any);
      db.column.update.mockResolvedValue({ ...makeColumnWithBoard({ position: 2 }) } as any);

      // Act: movemos de posición 0 a posición 2
      await reorderColumn('col-0', 'user-1', { position: 2 });

      // Assert: { gt: oldPos(0), lte: newPos(2) } = posiciones 1, 2 → decrementan
      expect(db.column.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            position: { gt: 0, lte: 2 },
          }),
          data: { position: { decrement: 1 } },
        }),
      );
    });
  });

  // ─── DELETE COLUMN ──────────────────────────────────────────────────────────

  describe('deleteColumn()', () => {
    /**
     * C4 — Eliminar columna cierra el hueco decrementando las siguientes
     * Después de borrar la columna en posición 1, las columnas con position > 1
     * deben decrementar para no dejar huecos en la secuencia.
     */
    it('C4 - decrementa la posición de todas las columnas posteriores al eliminar', async () => {
      // Arrange: la columna está en posición 1
      db.column.findUnique.mockResolvedValue(makeColumnWithBoard({ position: 1, id: 'col-1' }) as any);
      db.column.delete.mockResolvedValue(makeColumnWithBoard({ position: 1 }) as any);

      // Act
      await deleteColumn('col-1', 'user-1');

      // Assert: updateMany cierra el hueco decrementando posiciones > 1
      expect(db.column.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            boardId: 'board-1',
            position: { gt: 1 },
          }),
          data: { position: { decrement: 1 } },
        }),
      );
    });
  });

  // ─── AUTORIZACIÓN ───────────────────────────────────────────────────────────

  describe('autorización', () => {
    /**
     * C5 — Operar sobre columna de otro usuario → 403 Forbidden
     * assertColumnOwnership verifica que board.ownerId === ownerId.
     * Si no coincide, lanza AppError 403 antes de cualquier modificación.
     */
    it('C5 - lanza AppError 403 al intentar reordenar una columna de otro usuario', async () => {
      // Arrange: la columna pertenece a 'other-user', no a 'user-1'
      db.column.findUnique.mockResolvedValue(
        makeColumnWithBoard({ ownerId: 'other-user' }) as any,
      );

      // Act: 'user-1' intenta reordenar la columna de 'other-user'
      const error = await reorderColumn('col-3', 'user-1', { position: 0 }).catch((e) => e);

      // Assert
      expect(error).toBeInstanceOf(AppError);
      expect(error.message).toBe('Forbidden');
      expect(error.statusCode).toBe(403);

      // Assert: NO se realizaron cambios en la BD
      expect(db.column.updateMany).not.toHaveBeenCalled();
      expect(db.column.update).not.toHaveBeenCalled();
    });
  });
});
