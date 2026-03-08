import { io, Socket } from 'socket.io-client';

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

let _socket: Socket | null = null;

export function getAdminSocket(token: string): Socket {
  if (_socket?.connected) return _socket;
  _socket = io(API_URL, {
    auth: { token },
    transports: ['websocket'],
  });
  return _socket;
}

export function disconnectAdminSocket() {
  _socket?.disconnect();
  _socket = null;
}

/**
 * Start streaming the browser's real GPS position as walker location events.
 * Returns a cleanup function to stop streaming.
 */
export function startGpsStream(opts: {
  token: string;
  dogId: string;
  bookingId: string;
  onError?: (err: string) => void;
}): () => void {
  const socket = getAdminSocket(opts.token);

  if (!navigator.geolocation) {
    opts.onError?.('Geolocation not supported by this browser.');
    return () => {};
  }

  const watchId = navigator.geolocation.watchPosition(
    (pos) => {
      socket.emit('location:push', {
        dogId: opts.dogId,
        bookingId: opts.bookingId,
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        accuracy: pos.coords.accuracy,
      });
    },
    (err) => {
      opts.onError?.(`GPS error: ${err.message}`);
    },
    { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 }
  );

  return () => navigator.geolocation.clearWatch(watchId);
}
