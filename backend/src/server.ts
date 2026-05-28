import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import app from './app';
import { env } from './config/env';
import { initSockets } from './sockets';

// Creamos el servidor HTTP envolviendo Express.
// Esto es necesario para que Socket.io y Express compartan el mismo puerto.
const httpServer = http.createServer(app);

// Inicializamos Socket.io sobre el servidor HTTP.
const io = new SocketIOServer(httpServer, {
  cors: {
    origin: env.CLIENT_URL,
    methods: ['GET', 'POST'],
  },
});

// Registramos todos los eventos de WebSocket.
initSockets(io);

// Arrancamos el servidor.
httpServer.listen(env.PORT, () => {
  console.log(`[server] Running on port ${env.PORT} in ${env.NODE_ENV} mode`);
});

export { io };
