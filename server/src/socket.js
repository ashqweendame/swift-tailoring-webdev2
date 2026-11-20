import { Server } from 'socket.io';
import { config } from './config.js';

// Customers join a room named after their order code; the API emits "order:changed" to that room.
export function createSocketServer(httpServer) {
  const io = new Server(httpServer, { cors: { origin: config.clientOrigin } });
  io.on('connection', (socket) => {
    const valid = (c) => typeof c === 'string' && c.length > 0 && c.length <= 32;
    socket.on('track', (code) => valid(code) && socket.join(`order:${code}`));
    socket.on('untrack', (code) => valid(code) && socket.leave(`order:${code}`));
  });
  return io;
}
