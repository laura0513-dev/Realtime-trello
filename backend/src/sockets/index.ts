import { Server, Socket } from 'socket.io';

// Referencia global al servidor Socket.io.
// Se inicializa en initSockets y se accede desde los controllers
// mediante getIO() para emitir eventos de negocio.
let _io: Server;

export function getIO(): Server {
  if (!_io) throw new Error('[socket] Socket.io not initialized yet');
  return _io;
}

// Punto de entrada para todos los eventos WebSocket.
// Separamos los handlers de sockets de las rutas HTTP porque responden
// a eventos en tiempo real, no a peticiones request/response.
export function initSockets(io: Server): void {
  _io = io;
  io.on('connection', (socket: Socket) => {
    console.log(`[socket] Client connected: ${socket.id}`);

    // Un usuario se une a la sala de un tablero específico.
    // Las "rooms" de Socket.io permiten emitir eventos solo a los
    // usuarios que están viendo ese tablero en ese momento.
    socket.on('board:join', (boardId: string) => {
      socket.join(`board:${boardId}`);
      console.log(`[socket] ${socket.id} joined board:${boardId}`);
    });

    socket.on('board:leave', (boardId: string) => {
      socket.leave(`board:${boardId}`);
    });

    socket.on('disconnect', () => {
      console.log(`[socket] Client disconnected: ${socket.id}`);
    });

    // Los eventos de negocio (card:moved, card:created, etc.)
    // se añadirán aquí en módulos separados.
  });
}
