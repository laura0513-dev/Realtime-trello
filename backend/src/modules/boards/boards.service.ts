import { prisma } from '../../config/database';
import { AppError } from '../../middlewares/errorHandler';
import type { CreateBoardInput, UpdateBoardInput } from './boards.schemas';

// Al crear un tablero, generamos automáticamente tres columnas por defecto
// (BACKLOG, ACTIVE, DONE) para que el usuario tenga un punto de partida,
// exactamente como lo hace Trello o JIRA al crear un proyecto nuevo.
export async function createBoard(ownerId: string, input: CreateBoardInput) {
  const board = await prisma.board.create({
    data: {
      title: input.title,
      ownerId,
      columns: {
        create: [
          { title: 'Backlog',     position: 0, type: 'BACKLOG' },
          { title: 'In Progress', position: 1, type: 'ACTIVE'  },
          { title: 'Done',        position: 2, type: 'DONE'    },
        ],
      },
    },
    // Devolvemos el tablero con sus columnas incluidas en una sola consulta
    include: { columns: { orderBy: { position: 'asc' } } },
  });

  return board;
}

export async function getBoards(ownerId: string) {
  return prisma.board.findMany({
    where: { ownerId },
    orderBy: { createdAt: 'desc' },
    // Solo devolvemos el conteo de columnas en el listado, no todo su contenido.
    // Cargar todo sería innecesario y lento cuando hay muchos tableros.
    include: { _count: { select: { columns: true } } },
  });
}

export async function getBoardById(boardId: string, ownerId: string) {
  const board = await prisma.board.findUnique({
    where: { id: boardId },
    include: {
      columns: {
        orderBy: { position: 'asc' },
        include: {
          cards: { orderBy: { position: 'asc' } },
        },
      },
    },
  });

  if (!board) {
    throw new AppError('Board not found', 404);
  }

  // Verificamos que el tablero pertenece al usuario que lo solicita.
  // Sin esta verificación, cualquier usuario autenticado podría ver tableros ajenos.
  if (board.ownerId !== ownerId) {
    throw new AppError('Forbidden', 403);
  }

  return board;
}

export async function updateBoard(
  boardId: string,
  ownerId: string,
  input: UpdateBoardInput,
) {
  // Reutilizamos getBoardById para verificar existencia y pertenencia
  await getBoardById(boardId, ownerId);

  return prisma.board.update({
    where: { id: boardId },
    data: { title: input.title },
  });
}

export async function deleteBoard(boardId: string, ownerId: string) {
  await getBoardById(boardId, ownerId);

  // Cascade en el schema elimina columnas y cards automáticamente
  await prisma.board.delete({ where: { id: boardId } });
}
