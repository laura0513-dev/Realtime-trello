/**
 * Tests unitarios para cards.controller.ts — WebSocket emissions
 *
 * Este archivo prueba que el controller emite los eventos de Socket.io
 * correctos después de cada operación sobre tarjetas.
 *
 * ─── APIS DE VITEST NUEVAS EN ESTE ARCHIVO ───────────────────────────────────
 *
 * vi.mock(ruta) — auto-mock
 *   Sin factory, Vitest reemplaza todas las exportaciones del módulo por
 *   vi.fn() automáticamente. Útil para servicios donde solo nos importa
 *   configurar el valor de retorno en cada test.
 *
 * mockReturnValue({ to: fn })
 *   Configura getIO() para retornar un objeto con .to() que a su vez retorna
 *   { emit: fn }. Simula la cadena getIO().to(room).emit(event, data).
 *
 * mockResolvedValue(data)
 *   Configura el mock del servicio para retornar una Promise resuelta con
 *   { card, boardId }. El controller desestructura este retorno.
 *
 * mockReturnThis()
 *   Hace que un mock retorne 'this' (el objeto receptor). Lo usamos en
 *   res.status(201) para que la cadena res.status(201).json(data) funcione:
 *   status() retorna res → json() se llama en res.
 *
 * vi.mocked(fn)
 *   Devuelve la función con el tipo de MockedFunction<T>. Necesario para
 *   llamar a .mockReturnValue() etc. en funciones que vienen de vi.mock().
 *
 * toHaveBeenCalledWith(args)
 *   Verifica que el mock del Socket.io fue llamado con el room correcto
 *   (to) y el evento correcto (emit). Esto prueba el aislamiento por sala:
 *   solo los sockets en 'board:boardId' reciben el evento.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * PATRÓN DE MOCK PARA SOCKET.IO:
 *
 *   const mockEmit = vi.fn()
 *   const mockTo   = vi.fn().mockReturnValue({ emit: mockEmit })
 *   vi.mocked(getIO).mockReturnValue({ to: mockTo } as any)
 *
 *   Después del controller:
 *   expect(mockTo).toHaveBeenCalledWith('board:board-1')   // sala correcta
 *   expect(mockEmit).toHaveBeenCalledWith('card:created', card) // evento + datos
 *
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { Response, NextFunction } from 'express';
import type { Mock } from 'vitest';

// ─── MOCKS ────────────────────────────────────────────────────────────────────

// 1. Auto-mock del servicio de tarjetas: todas sus funciones pasan a ser vi.fn()
vi.mock('../modules/cards/cards.service', () => ({
  createCard: vi.fn(),
  updateCard: vi.fn(),
  moveCard: vi.fn(),
  deleteCard: vi.fn(),
}));

// 2. Mock del módulo Socket.io: getIO() se reemplaza por vi.fn()
//    El valor de retorno (io.to().emit()) se configura en cada test.
vi.mock('../sockets', () => ({
  getIO: vi.fn(),
}));

// ─── IMPORTACIONES DEL MÓDULO BAJO TEST ──────────────────────────────────────

import {
  createCard as createCardController,
  moveCard as moveCardController,
  deleteCard as deleteCardController,
} from '../modules/cards/cards.controller';
import * as cardsService from '../modules/cards/cards.service';
import { getIO } from '../sockets';
import type { AuthRequest } from '../middlewares/auth';

// ─── HELPERS ──────────────────────────────────────────────────────────────────

/** Tarjeta de prueba que el servicio devuelve */
const MOCK_CARD = {
  id: 'card-1',
  title: 'Implementar login',
  description: null,
  position: 0,
  columnId: 'col-1',
  createdAt: new Date(),
  updatedAt: new Date(),
};

const BOARD_ID = 'board-1';

/**
 * Crea un mock de Express Request listo para el controller de tarjetas.
 * El controller necesita: req.params, req.body y req.user.
 */
const makeReq = (params: Record<string, string>, body: Record<string, unknown>): AuthRequest =>
  ({
    params,
    body,
    user: { id: 'user-1', email: 'laura@test.com' },
    headers: {},
  }) as unknown as AuthRequest;

/**
 * Crea un mock de Express Response con la cadena status().json() correcta.
 * mockReturnThis() hace que status() retorne 'this' (el objeto res),
 * de modo que res.status(201).json(data) llama a res.json(data).
 */
const makeRes = () => {
  const send = vi.fn();
  const json = vi.fn();
  const status = vi.fn().mockReturnThis();
  return { status, json, send } as unknown as Response;
};

const makeNext = () => vi.fn() as unknown as NextFunction;

// ─────────────────────────────────────────────────────────────────────────────

describe('Cards Controller — WebSocket emissions', () => {
  // Variables para los mocks de Socket.io, reasignadas en cada test
  let mockEmit: Mock;
  let mockTo: Mock;

  beforeEach(() => {
    vi.clearAllMocks();

    // Reconfiguramos la cadena getIO().to(room).emit(event, data) antes de cada test
    // mockEmit → captura el evento y los datos emitidos
    // mockTo   → captura el room al que se envía el evento
    mockEmit = vi.fn();
    mockTo = vi.fn().mockReturnValue({ emit: mockEmit });
    (getIO as Mock).mockReturnValue({ to: mockTo });
  });

  // ─── W1: card:created ───────────────────────────────────────────────────────

  /**
   * W1 — createCard emite evento 'card:created' al room del tablero correcto
   *
   * Flujo del controller:
   * 1. Parsea req.body con createCardSchema
   * 2. Llama a cardsService.createCard → recibe { card, boardId }
   * 3. getIO().to(`board:${boardId}`).emit('card:created', card)
   * 4. res.status(201).json(card)
   *
   * AISLAMIENTO DE SALA: al usar .to('board:board-1'), Socket.io garantiza que
   * SOLO los clientes conectados a ese room reciben el evento. Usuarios en
   * otros tableros no son afectados.
   */
  it('W1 - emite card:created al room del tablero correcto', async () => {
    // Arrange: el servicio retorna la tarjeta creada con el boardId
    vi.mocked(cardsService.createCard).mockResolvedValue({
      card: MOCK_CARD,
      boardId: BOARD_ID,
    } as any);

    const req = makeReq({ columnId: 'col-1' }, { title: 'Implementar login' });
    const res = makeRes();
    const next = makeNext();

    // Act
    await createCardController(req, res, next);

    // Assert: getIO() fue invocado
    expect(getIO).toHaveBeenCalledTimes(1);

    // Assert: el evento se envió ÚNICAMENTE al room del tablero correcto
    // 'board:board-1' → solo usuarios con ese tablero abierto reciben el evento
    expect(mockTo).toHaveBeenCalledWith('board:board-1');

    // Assert: se emitió el evento correcto con los datos de la tarjeta
    expect(mockEmit).toHaveBeenCalledWith('card:created', MOCK_CARD);

    // Assert: la respuesta HTTP fue 201 con la tarjeta
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(MOCK_CARD);
  });

  // ─── W2: card:moved ─────────────────────────────────────────────────────────

  /**
   * W2 — moveCard emite evento 'card:moved' al room del tablero correcto
   *
   * Este evento es especialmente importante para la UI: al recibir 'card:moved',
   * todos los clientes conectados al tablero actualizan el Kanban en tiempo real
   * sin recargar la página.
   */
  it('W2 - emite card:moved al room del tablero tras mover una tarjeta', async () => {
    const movedCard = { ...MOCK_CARD, columnId: 'col-2', position: 1 };

    vi.mocked(cardsService.moveCard).mockResolvedValue({
      card: movedCard,
      boardId: BOARD_ID,
    } as any);

    const req = makeReq({ cardId: 'card-1' }, { columnId: 'col-2', position: 1 });
    const res = makeRes();
    const next = makeNext();

    await moveCardController(req, res, next);

    expect(mockTo).toHaveBeenCalledWith('board:board-1');
    expect(mockEmit).toHaveBeenCalledWith('card:moved', movedCard);
    expect(res.json).toHaveBeenCalledWith(movedCard);
  });

  // ─── W3: Aislamiento de sala ─────────────────────────────────────────────────

  /**
   * W3 — Verificación explícita del aislamiento por sala (room isolation)
   *
   * Este test confirma que el evento se emite con el boardId EXACTO retornado
   * por el servicio. Si el servicio retorna boardId='board-99', el evento
   * debe ir a 'board:board-99', NO a ningún otro room.
   *
   * Esto prueba el contrato de aislamiento: cambios en el tablero A no generan
   * eventos en el tablero B, aunque ambos estén activos en el servidor.
   */
  it('W3 - el evento se emite ÚNICAMENTE al room del boardId específico retornado por el servicio', async () => {
    const DIFFERENT_BOARD_ID = 'board-99';

    vi.mocked(cardsService.createCard).mockResolvedValue({
      card: MOCK_CARD,
      boardId: DIFFERENT_BOARD_ID, // board distinto al por defecto
    } as any);

    const req = makeReq({ columnId: 'col-1' }, { title: 'Test' });
    const res = makeRes();
    const next = makeNext();

    await createCardController(req, res, next);

    // Assert: el room es exactamente 'board:board-99', no cualquier otro room
    expect(mockTo).toHaveBeenCalledWith('board:board-99');

    // Assert: NO fue llamado con un room distinto (aislamiento confirmado)
    expect(mockTo).not.toHaveBeenCalledWith('board:board-1');
    expect(mockTo).not.toHaveBeenCalledWith('board:board-2');

    // Assert: mockTo fue llamado exactamente UNA vez (sin broadcasts extra)
    expect(mockTo).toHaveBeenCalledTimes(1);
  });
});
