import { prisma } from '../../config/database';
import { AppError } from '../../middlewares/errorHandler';
import type { CreateCardInput, UpdateCardInput, MoveCardInput } from './cards.schemas';

// Verifica que la columna existe y pertenece a un tablero del usuario.
async function assertColumnOwnership(columnId: string, ownerId: string) {
  const column = await prisma.column.findUnique({
    where: { id: columnId },
    include: { board: true },
  });
  if (!column) throw new AppError('Column not found', 404);
  if (column.board.ownerId !== ownerId) throw new AppError('Forbidden', 403);
  return column;
}

// Verifica que la card existe y pertenece a un tablero del usuario.
async function assertCardOwnership(cardId: string, ownerId: string) {
  const card = await prisma.card.findUnique({
    where: { id: cardId },
    include: { column: { include: { board: true } } },
  });
  if (!card) throw new AppError('Card not found', 404);
  if (card.column.board.ownerId !== ownerId) throw new AppError('Forbidden', 403);
  return card;
}

export async function createCard(
  columnId: string,
  ownerId: string,
  input: CreateCardInput,
) {
  await assertColumnOwnership(columnId, ownerId);

  // La card nueva va al final de la columna
  const lastCard = await prisma.card.findFirst({
    where: { columnId },
    orderBy: { position: 'desc' },
  });
  const position = lastCard ? lastCard.position + 1 : 0;

  return prisma.card.create({
    data: {
      title:       input.title,
      description: input.description ?? null,
      position,
      columnId,
    },
  });
}

export async function updateCard(
  cardId: string,
  ownerId: string,
  input: UpdateCardInput,
) {
  await assertCardOwnership(cardId, ownerId);

  return prisma.card.update({
    where: { id: cardId },
    data: {
      ...(input.title       !== undefined && { title:       input.title }),
      // null borra la descripción; undefined la deja sin cambiar
      ...(input.description !== undefined && { description: input.description }),
    },
  });
}

export async function moveCard(
  cardId: string,
  ownerId: string,
  input: MoveCardInput,
) {
  const card = await assertCardOwnership(cardId, ownerId);

  // Verificamos que la columna destino también pertenece al mismo usuario
  await assertColumnOwnership(input.columnId, ownerId);

  const oldColumnId  = card.columnId;
  const oldPosition  = card.position;
  const newColumnId  = input.columnId;
  const newPosition  = input.position;
  const sameColumn   = oldColumnId === newColumnId;

  // --- Caso 1: movimiento dentro de la misma columna ---
  if (sameColumn) {
    if (oldPosition === newPosition) return card;

    if (newPosition < oldPosition) {
      await prisma.card.updateMany({
        where: { columnId: oldColumnId, position: { gte: newPosition, lt: oldPosition } },
        data:  { position: { increment: 1 } },
      });
    } else {
      await prisma.card.updateMany({
        where: { columnId: oldColumnId, position: { gt: oldPosition, lte: newPosition } },
        data:  { position: { decrement: 1 } },
      });
    }

    return prisma.card.update({
      where: { id: cardId },
      data:  { position: newPosition },
    });
  }

  // --- Caso 2: movimiento entre columnas distintas ---
  // 1. Cerramos el hueco en la columna origen
  await prisma.card.updateMany({
    where: { columnId: oldColumnId, position: { gt: oldPosition } },
    data:  { position: { decrement: 1 } },
  });

  // 2. Abrimos hueco en la columna destino
  await prisma.card.updateMany({
    where: { columnId: newColumnId, position: { gte: newPosition } },
    data:  { position: { increment: 1 } },
  });

  // 3. Movemos la card
  return prisma.card.update({
    where: { id: cardId },
    data:  { columnId: newColumnId, position: newPosition },
  });
}

export async function deleteCard(cardId: string, ownerId: string) {
  const card = await assertCardOwnership(cardId, ownerId);

  await prisma.card.delete({ where: { id: cardId } });

  // Cerramos el hueco en la columna
  await prisma.card.updateMany({
    where: { columnId: card.columnId, position: { gt: card.position } },
    data:  { position: { decrement: 1 } },
  });
}
