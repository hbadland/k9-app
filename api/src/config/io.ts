import { Server } from 'socket.io';

let _io: Server | null = null;

export const setIo = (io: Server) => { _io = io; };
export const getIo = () => _io;
