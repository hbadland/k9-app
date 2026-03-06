CREATE TABLE IF NOT EXISTS dog_locations (
  id          SERIAL PRIMARY KEY,
  dog_id      UUID NOT NULL REFERENCES dogs(id) ON DELETE CASCADE,
  booking_id  UUID REFERENCES bookings(id),
  latitude    DOUBLE PRECISION NOT NULL,
  longitude   DOUBLE PRECISION NOT NULL,
  accuracy    REAL,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS dog_locations_dog_id_recorded_at_idx ON dog_locations(dog_id, recorded_at DESC);
CREATE INDEX IF NOT EXISTS dog_locations_booking_id_idx ON dog_locations(booking_id);
