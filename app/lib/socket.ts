import { io, Socket } from 'socket.io-client';

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000';
let _socket: Socket | null = null;

export function getSocket(token: string): Socket {
  if (!_socket) {
    _socket = io(API_URL, { auth: { token }, transports: ['websocket'], autoConnect: false });
  }
  (_socket as any).auth = { token };
  if (!_socket.connected) _socket.connect();
  return _socket;
}

export function disconnectSocket() {
  _socket?.disconnect();
  _socket = null;
}
