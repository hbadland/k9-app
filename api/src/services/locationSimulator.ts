import { Server } from 'socket.io';

const BASE_LAT = 51.4669; // Clapham Common
const BASE_LNG = -0.1651;
const RADIUS_KM = 0.3;

class LocationSimulator {
  private io?: Server;
  private intervals = new Map<string, NodeJS.Timeout>();
  private steps     = new Map<string, number>();

  init(io: Server) { this.io = io; }

  start(dogId: string, bookingId: string) {
    if (this.intervals.has(dogId)) return;
    this.steps.set(dogId, 0);
    const iv = setInterval(() => {
      const step  = (this.steps.get(dogId)! + 1);
      this.steps.set(dogId, step);
      const angle = (step * 2 * Math.PI) / 120; // full circle in ~10 min
      const lat   = BASE_LAT + (RADIUS_KM / 111) * Math.sin(angle);
      const lng   = BASE_LNG + (RADIUS_KM / (111 * Math.cos(BASE_LAT * Math.PI / 180))) * Math.cos(angle);
      this.io?.to(`dog:${dogId}`).emit('location:update', {
        lat, lng, accuracy: 5, timestamp: new Date().toISOString(),
      });
    }, 5000);
    this.intervals.set(dogId, iv);
  }

  stop(dogId: string) {
    const iv = this.intervals.get(dogId);
    if (iv) { clearInterval(iv); this.intervals.delete(dogId); }
    this.steps.delete(dogId);
  }

  isActive(dogId: string) { return this.intervals.has(dogId); }
}

export const simulator = new LocationSimulator();
