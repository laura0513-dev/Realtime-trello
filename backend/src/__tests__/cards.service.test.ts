/**
 * Tests unitarios para cards.service.ts
 *
 * ─── APIS DE VITEST NUEVAS EN ESTE ARCHIVO ───────────────────────────────────
 *
 * toHaveBeenCalledTimes(n)
 *   Verificamos que updateMany se llama exactamente 2 veces en moveCard
 *   cross-column (una para cerrar el hueco, otra para abrir el hueco).
 *
 * toHaveBeenNthCalledWith(n, args)
 *   Verifica los argumentos de la N-ésima llamada. Indispensable cuando un
 *   mock se invoca varias veces con argumentos distintos y necesitamos
 *   verificar cada llamada individualmente.
 *
 * expect.objectContaining({ key: val })
 *   Matcher parcial para objetos Prisma complejos donde solo nos importan
 *   algunas propiedades de la query (where, data, etc.).
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

import { createCard, moveCard, deleteCard } from '../modules/cards/cards.service';
import { prisma } from '../config/database';
import { AppError } from '../middlewares/errorHandler';

type MockPrisma = ReturnType<typeof mockDeep<PrismaClient>>;
const db = prisma as unknown as MockPrisma;

// ─── HELPERS ──────────────────────────────────────────────────────────────────

/**
 * Crea un mock de tarjeta con columna y tablero anidados.
 * assertCardOwnership requiere: card.column.board.ownerId
 * moveCard usa: card.columnId, card.position, card.column.boardId
 */
const makeCardWithRelations = (opts: {
  id?: string;
  columnId?: string;
  position?: number;
  ownerId?: string;
  boardId?: string;
} = {}) => ({
  id: opts.id ?? 'card-1',
  title: 'Test Card',
  description: null,
  position: opts.position ?? 0,
  columnId: opts.columnId ?? 'col-1',
  createdAt: new Date(),
  updatedAt: new Date(),
  column: {
    id: opts.columnId ?? 'col-1',
    title: 'Test Col',
    position: 0,
    type: 'ACTIVE',
    color: null,
    // boardId es el FK escalar que usa moveCard para el retorno
    boardId: opts.boardId ?? 'board-1',
    createdAt: new Date(),
    updatedAt: new Date(),
    board: {
      id: opts.boardId ?? 'board-1',
      title: 'Mi Tablero',
      ownerId: opts.ownerId ?? 'user-1',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  },
});

/** Crea un mock de columna con tablero anidado para assertColumnOwnership */
const makeColumnWithBoard = (opts: { id?: string; boardId?: string; ownerId?: string } = {}) => ({
  id: opts.id ?? 'col-1',
  title: 'Test Col',
  position: 0,
  type: 'ACTIVE',
  color: null,
  boardId: opts.boardId ?? 'board-1',
  createdAt: new Date(),
  updatedAt: new Date(),
  board: {
    id: opts.boardId ?? 'board-1',
    title: 'Mi Tablero',
    ownerId: opts.ownerId ?? 'user-1',
    createdAt: new Date(),
    updatedAt: new Date(),
  },
});

// ─────────────────────────────────────────────────────────────────────────────

describe('Cards Service', () => {
  beforeEach(() => {
    mockReset(db);
    // Valores por defecto para operaciones de escritura
    db.card.updateMany.mockResolvedValue({ count: 0 } as any);
    db.card.delete.mockResolvedValue({} as any);
  });

  // ─── CREATE CARD ────────────────────────────────────────────────────────────

  describe('createCard()', () => {
    /**
     * D1 — Nueva tarjeta se añade al final (position = lastCard.position + 1)
     * El servicio busca con findFirst({ orderBy: { position: 'desc' } }) la última
     * tarjeta de la columna. Si está en posición 1, la nueva va en posición 2.
     */
    it('D1 - asigna position = lastCard.position + 1 a la nueva tarjeta', async () => {
      // Arrange: la columna pertenece al usuario (assertColumnOwnership pasa)
      db.column.findUnique.mockResolvedValue(makeColumnWithBoard() as any);

      // Arrange: la última tarjeta de la columna está en posición 1
      db.card.findFirst.mockResolvedValue({ position: 1 } as any);

      // Arrange: Prisma crea la tarjeta
      const newCard = {
        id: 'card-new',
        title: 'Nueva Tarea',
        description: null,
        position: 2,
        columnId: 'col-1',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      db.card.create.mockResolvedValue(newCard as any);

      // Act
      const result = await createCard('col-1', 'user-1', { title: 'Nueva Tarea' });

      // Assert: la tarjeta creada tiene posición 2 (1+1)
      expect(result.card.position).toBe(2);

      // Assert: Prisma.create fue llamado con position: 2
      expect(db.card.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ position: 2, columnId: 'col-1' }),
        }),
      );
    });
  });

  // ─── MOVE CARD (MISMA COLUMNA) ──────────────────────────────────────────────

  describe('moveCard() — misma columna', () => {
    /**
     * D2 — Mover tarjeta hacia arriba en la misma columna (posición 2 → 0)
     * Las tarjetas en posiciones 0 y 1 deben incrementar (bajar un hueco).
     * Condición: sameColumn=true, newPos < oldPos →
     *   updateMany { gte: newPos, lt: oldPos } + increment
     */
    it('D2 - mover hacia arriba en misma columna incrementa tarjetas intermedias', async () => {
      // Arrange: la tarjeta está en posición 2, misma columna col-1
      db.card.findUnique.mockResolvedValue(
        makeCardWithRelations({ position: 2, columnId: 'col-1' }) as any,
      );
      // assertColumnOwnership para la columna destino (misma col-1)
      db.column.findUnique.mockResolvedValue(makeColumnWithBoard({ id: 'col-1' }) as any);

      db.card.update.mockResolvedValue({ id: 'card-1', position: 0, columnId: 'col-1' } as any);

      // Act: mover la tarjeta de posición 2 a posición 0 (misma columna)
      await moveCard('card-1', 'user-1', { columnId: 'col-1', position: 0 });

      // Assert: tarjetas en posiciones 0 y 1 se desplazan hacia abajo
      expect(db.card.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            columnId: 'col-1',
            position: { gte: 0, lt: 2 },
          }),
          data: { position: { increment: 1 } },
        }),
      );
    });

    /**
     * D3 — Mover tarjeta hacia abajo en la misma columna (posición 0 → 2)
     * Las tarjetas en posiciones 1 y 2 deben decrementar (subir un hueco).
     * Condición: sameColumn=true, newPos > oldPos →
     *   updateMany { gt: oldPos, lte: newPos } + decrement
     */
    it('D3 - mover hacia abajo en misma columna decrementa tarjetas intermedias', async () => {
      // Arrange: la tarjeta está en posición 0
      db.card.findUnique.mockResolvedValue(
        makeCardWithRelations({ position: 0, columnId: 'col-1' }) as any,
      );
      db.column.findUnique.mockResolvedValue(makeColumnWithBoard({ id: 'col-1' }) as any);
      db.card.update.mockResolvedValue({ id: 'card-1', position: 2, columnId: 'col-1' } as any);

      // Act: mover de posición 0 a posición 2
      await moveCard('card-1', 'user-1', { columnId: 'col-1', position: 2 });

      // Assert: tarjetas en posiciones 1 y 2 suben un hueco
      expect(db.card.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            columnId: 'col-1',
            position: { gt: 0, lte: 2 },
          }),
          data: { position: { decrement: 1 } },
        }),
      );
    });
  });

  // ─── MOVE CARD (COLUMNA CRUZADA) ────────────────────────────────────────────

  describe('moveCard() — columna cruzada', () => {
    /**
     * D4 — Mover tarjeta entre columnas diferentes (col-1 posición 0 → col-2 posición 0)
     *
     * Operaciones en orden:
     * 1. Cerrar hueco en col-1: updateMany { columnId: 'col-1', position: { gt: 0 } } decrement
     * 2. Abrir hueco en col-2: updateMany { columnId: 'col-2', position: { gte: 0 } } increment
     * 3. Mover la tarjeta:      card.update { columnId: 'col-2', position: 0 }
     *
     * Verificamos cada llamada individualmente con toHaveBeenNthCalledWith.
     */
    it('D4 - mueve entre columnas cerrando hueco en origen y abriendo en destino', async () => {
      // Arrange: tarjeta en col-1 posición 0
      db.card.findUnique.mockResolvedValue(
        makeCardWithRelations({ columnId: 'col-1', position: 0 }) as any,
      );

      // Arrange: columna destino col-2 pertenece al mismo usuario
      db.column.findUnique.mockResolvedValue(
        makeColumnWithBoard({ id: 'col-2', boardId: 'board-1' }) as any,
      );

      // Arrange: card.update retorna la tarjeta en su nueva posición
      db.card.update.mockResolvedValue({
        id: 'card-1',
        columnId: 'col-2',
        position: 0,
        title: 'Test Card',
        description: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any);

      // Act
      const result = await moveCard('card-1', 'user-1', { columnId: 'col-2', position: 0 });

      // Assert: updateMany se llamó exactamente 2 veces (cierre + apertura de hueco)
      expect(db.card.updateMany).toHaveBeenCalledTimes(2);

      // Assert 1ª llamada: cerrar hueco en col-1 (cards con position > 0 bajan)
      expect(db.card.updateMany).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          where: expect.objectContaining({
            columnId: 'col-1',
            position: { gt: 0 },
          }),
          data: { position: { decrement: 1 } },
        }),
      );

      // Assert 2ª llamada: abrir hueco en col-2 (cards con position >= 0 suben)
      expect(db.card.updateMany).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          where: expect.objectContaining({
            columnId: 'col-2',
            position: { gte: 0 },
          }),
          data: { position: { increment: 1 } },
        }),
      );

      // Assert: la tarjeta fue actualizada a la columna y posición correctas
      expect(db.card.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'card-1' },
          data: expect.objectContaining({ columnId: 'col-2', position: 0 }),
        }),
      );

      // Assert: el boardId retornado es correcto (para el evento WebSocket)
      expect(result.boardId).toBe('board-1');
    });
  });

  // ─── DELETE CARD ────────────────────────────────────────────────────────────

  describe('deleteCard()', () => {
    /**
     * D5 — Eliminar tarjeta cierra el hueco en la columna
     * Después de borrar la tarjeta en posición 1, las tarjetas con
     * position > 1 en la misma columna deben decrementar su posición.
     */
    it('D5 - decrementa tarjetas posteriores en la misma columna al eliminar', async () => {
      // Arrange: tarjeta en posición 1
      db.card.findUnique.mockResolvedValue(
        makeCardWithRelations({ position: 1, columnId: 'col-1' }) as any,
      );
      db.card.delete.mockResolvedValue({} as any);

      // Act
      await deleteCard('card-1', 'user-1');

      // Assert: updateMany cierra el hueco (position > 1 → decrement)
      expect(db.card.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            columnId: 'col-1',
            position: { gt: 1 },
          }),
          data: { position: { decrement: 1 } },
        }),
      );
    });

    /**
     * D6 — Operar sobre tarjeta de otro usuario → 403 Forbidden
     * assertCardOwnership verifica card.column.board.ownerId === ownerId.
     */
    it('D6 - lanza AppError 403 al intentar eliminar una tarjeta de otro usuario', async () => {
      // Arrange: la tarjeta pertenece a 'other-user'
      db.card.findUnique.mockResolvedValue(
        makeCardWithRelations({ ownerId: 'other-user' }) as any,
      );

      // Act
      const error = await deleteCard('card-1', 'user-1').catch((e) => e);

      // Assert
      expect(error).toBeInstanceOf(AppError);
      expect(error.message).toBe('Forbidden');
      expect(error.statusCode).toBe(403);

      // Assert: la tarjeta NO fue eliminada de la BD
      expect(db.card.delete).not.toHaveBeenCalled();
      expect(db.card.updateMany).not.toHaveBeenCalled();
    });
  });
});
