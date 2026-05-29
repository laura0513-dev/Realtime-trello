import { prisma } from '../../config/database';
import { AppError } from '../../middlewares/errorHandler';
import type { CreateColumnInput, UpdateColumnInput, ReorderColumnInput } from './columns.schemas';

// Verifica que el tablero existe y pertenece al usuario antes de operar sobre sus columnas.
// Reutilizamos esta lógica en cada operación para no repetir el mismo chequeo.
async function assertBoardOwnership(boardId: string, ownerId: string) {
  const board = await prisma.board.findUnique({ where: { id: boardId } });
  if (!board) throw new AppError('Board not found', 404);
  if (board.ownerId !== ownerId) throw new AppError('Forbidden', 403);
  return board;
}

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

export async function createColumn(
  boardId: string,
  ownerId: string,
  input: CreateColumnInput,
) {
  await assertBoardOwnership(boardId, ownerId);

  // Calculamos la posición: la nueva columna va al final
  const lastColumn = await prisma.column.findFirst({
    where: { boardId },
    orderBy: { position: 'desc' },
  });
  const position = lastColumn ? lastColumn.position + 1 : 0;

  const column = await prisma.column.create({
    data: {
      title:   input.title,
      type:    input.type ?? 'ACTIVE',
      color:   input.color ?? null,
      position,
      boardId,
    },
  });
  return { column, boardId };
}

export async function updateColumn(
  columnId: string,
  ownerId: string,
  input: UpdateColumnInput,
) {
  const existing = await assertColumnOwnership(columnId, ownerId);

  const column = await prisma.column.update({
    where: { id: columnId },
    data: {
      ...(input.title !== undefined && { title: input.title }),
      ...(input.type  !== undefined && { type:  input.type  }),
      // null permite borrar el color; undefined lo deja sin cambiar
      ...(input.color !== undefined && { color: input.color ?? null }),
    },
  });
  return { column, boardId: existing.boardId };
}

export async function reorderColumn(
  columnId: string,
  ownerId: string,
  input: ReorderColumnInput,
) {
  const column = await assertColumnOwnership(columnId, ownerId);

  const { boardId, position: oldPosition } = column;
  const newPosition = input.position;

  if (oldPosition === newPosition) return { column, boardId };

  // Desplazamos las columnas afectadas para hacer hueco a la nueva posición.
  // Si la columna sube (newPosition < oldPosition), las columnas intermedias bajan.
  // Si la columna baja (newPosition > oldPosition), las columnas intermedias suben.
  if (newPosition < oldPosition) {
    await prisma.column.updateMany({
      where: {
        boardId,
        position: { gte: newPosition, lt: oldPosition },
      },
      data: { position: { increment: 1 } },
    });
  } else {
    await prisma.column.updateMany({
      where: {
        boardId,
        position: { gt: oldPosition, lte: newPosition },
      },
      data: { position: { decrement: 1 } },
    });
  }

  const updated = await prisma.column.update({
    where: { id: columnId },
    data:  { position: newPosition },
  });
  return { column: updated, boardId };
}

export async function deleteColumn(columnId: string, ownerId: string) {
  const column = await assertColumnOwnership(columnId, ownerId);
  const boardId = column.boardId;

  await prisma.column.delete({ where: { id: columnId } });

  // Reordenamos las columnas restantes para que no queden huecos en las posiciones
  await prisma.column.updateMany({
    where: {
      boardId:  column.boardId,
      position: { gt: column.position },
    },
    data: { position: { decrement: 1 } },
  });

  return { columnId, boardId };
}
