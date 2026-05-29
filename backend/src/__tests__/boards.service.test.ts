/**
 * Tests unitarios para boards.service.ts
 *
 * ─── APIS DE VITEST NUEVAS EN ESTE ARCHIVO ───────────────────────────────────
 *
 * toHaveLength(n)
 *   Verifica que un array o string tiene exactamente n elementos.
 *
 * toHaveBeenCalledWith(args)
 *   Verifica que el mock fue llamado con esos argumentos exactos en alguna
 *   de sus invocaciones. Puede usarse con expect.objectContaining() para
 *   verificar solo un subconjunto de las propiedades del argumento.
 *
 * expect.objectContaining({ key: val })
 *   Matcher parcial que permite verificar solo las propiedades que nos
 *   interesan, ignorando el resto. Muy útil con objetos Prisma que tienen
 *   muchos campos (id, createdAt, updatedAt, etc.).
 *
 * toMatchObject({ key: val })
 *   Similar a expect.objectContaining pero usado directamente en el valor
 *   bajo test: expect(obj).toMatchObject({ ... })
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

import { createBoard, getBoards, getBoardById } from '../modules/boards/boards.service';
import { prisma } from '../config/database';
import { AppError } from '../middlewares/errorHandler';

type MockPrisma = ReturnType<typeof mockDeep<PrismaClient>>;
const db = prisma as unknown as MockPrisma;

// ─── DATOS DE PRUEBA REUTILIZABLES ────────────────────────────────────────────

/** Las 3 columnas por defecto que crea createBoard automáticamente */
const DEFAULT_COLUMNS = [
  { id: 'col-1', title: 'Backlog', position: 0, type: 'BACKLOG', color: null, boardId: 'board-1', createdAt: new Date(), updatedAt: new Date() },
  { id: 'col-2', title: 'In Progress', position: 1, type: 'ACTIVE', color: null, boardId: 'board-1', createdAt: new Date(), updatedAt: new Date() },
  { id: 'col-3', title: 'Done', position: 2, type: 'DONE', color: null, boardId: 'board-1', createdAt: new Date(), updatedAt: new Date() },
];

const MOCK_BOARD = {
  id: 'board-1',
  title: 'Mi Tablero Kanban',
  ownerId: 'user-1',
  createdAt: new Date(),
  updatedAt: new Date(),
  columns: DEFAULT_COLUMNS,
};

// ─────────────────────────────────────────────────────────────────────────────

describe('Boards Service', () => {
  beforeEach(() => {
    mockReset(db);
  });

  // ─── CREATE BOARD ───────────────────────────────────────────────────────────

  describe('createBoard()', () => {
    /**
     * B1 — Crear tablero genera exactamente 3 columnas por defecto
     * createBoard usa prisma.board.create con nested columns.create para
     * crear Backlog, In Progress y Done en una sola transacción atómica.
     */
    it('B1 - retorna el tablero con exactamente 3 columnas por defecto', async () => {
      // Arrange: Prisma create retorna el tablero con columnas anidadas
      db.board.create.mockResolvedValue(MOCK_BOARD as any);

      // Act
      const result = await createBoard('user-1', { title: 'Mi Tablero Kanban' });

      // Assert: el tablero tiene exactamente 3 columnas
      expect(result.columns).toHaveLength(3);

      // Assert: prisma.board.create fue llamado (no board.createMany)
      expect(db.board.create).toHaveBeenCalledTimes(1);
    });

    /**
     * B2 — Las columnas tienen los tipos y posiciones correctas
     * El orden Backlog(0) → In Progress(1) → Done(2) es parte del contrato
     * de la API. Cambiar esto rompería el flujo Kanban esperado.
     */
    it('B2 - las columnas tienen tipos BACKLOG/ACTIVE/DONE en posiciones 0/1/2', async () => {
      db.board.create.mockResolvedValue(MOCK_BOARD as any);

      const result = await createBoard('user-1', { title: 'Mi Tablero Kanban' });

      // Verificamos el tipo Y la posición de cada columna por defecto
      expect(result.columns[0]).toMatchObject({ type: 'BACKLOG', position: 0 });
      expect(result.columns[1]).toMatchObject({ type: 'ACTIVE', position: 1 });
      expect(result.columns[2]).toMatchObject({ type: 'DONE', position: 2 });
    });
  });

  // ─── GET BOARDS ─────────────────────────────────────────────────────────────

  describe('getBoards()', () => {
    /**
     * B3 — getBoards solo retorna los tableros del usuario autenticado
     * Verificamos que la query tiene { where: { ownerId } } para que
     * un usuario nunca pueda ver los tableros de otro usuario.
     */
    it('B3 - consulta la BD filtrando por ownerId del usuario autenticado', async () => {
      const mockBoards = [MOCK_BOARD];
      db.board.findMany.mockResolvedValue(mockBoards as any);

      await getBoards('user-1');

      // Assert: la query de Prisma filtra EXACTAMENTE por el ownerId correcto
      expect(db.board.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { ownerId: 'user-1' },
        }),
      );
    });
  });

  // ─── GET BOARD BY ID ────────────────────────────────────────────────────────

  describe('getBoardById()', () => {
    /**
     * B4 — Acceder al tablero de otro usuario → 403 Forbidden
     * El servicio comprueba que board.ownerId === ownerId. Si no coincide,
     * lanza AppError 403. No se retorna el tablero aunque exista en la BD.
     */
    it('B4 - lanza AppError 403 al intentar acceder a un tablero de otro usuario', async () => {
      // Arrange: el tablero existe pero pertenece a 'other-user'
      db.board.findUnique.mockResolvedValue({
        ...MOCK_BOARD,
        ownerId: 'other-user', // NO coincide con el usuario autenticado
      } as any);

      // Act: el usuario 'user-1' intenta acceder al tablero de 'other-user'
      const error = await getBoardById('board-1', 'user-1').catch((e) => e);

      // Assert
      expect(error).toBeInstanceOf(AppError);
      expect(error.message).toBe('Forbidden');
      expect(error.statusCode).toBe(403);
    });

    /**
     * Bonus — Tablero no encontrado → 404
     */
    it('lanza AppError 404 si el tablero no existe', async () => {
      db.board.findUnique.mockResolvedValue(null);

      const error = await getBoardById('id-inexistente', 'user-1').catch((e) => e);

      expect(error).toBeInstanceOf(AppError);
      expect(error.statusCode).toBe(404);
    });
  });
});
