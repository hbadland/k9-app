-- Services catalogue
CREATE TABLE IF NOT EXISTS services (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name             TEXT NOT NULL,
  description      TEXT,
  type             TEXT NOT NULL,  -- 'walk' | 'daycare' | 'training'
  duration_minutes INT  NOT NULL DEFAULT 60,
  price_pence      INT  NOT NULL DEFAULT 0,
  active           BOOLEAN NOT NULL DEFAULT TRUE,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

-- Admin-created availability slots
CREATE TABLE IF NOT EXISTS availability_slots (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id  UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  date        DATE NOT NULL,
  start_time  TIME NOT NULL,
  end_time    TIME NOT NULL,
  capacity    INT  NOT NULL DEFAULT 1,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Bookings
CREATE TABLE IF NOT EXISTS bookings (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id   UUID NOT NULL REFERENCES users(id)              ON DELETE CASCADE,
  dog_id     UUID NOT NULL REFERENCES dogs(id)               ON DELETE CASCADE,
  slot_id    UUID NOT NULL REFERENCES availability_slots(id) ON DELETE CASCADE,
  status     TEXT NOT NULL DEFAULT 'pending',  -- pending | confirmed | in_progress | completed | cancelled
  notes      TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for common queries
CREATE INDEX IF NOT EXISTS idx_bookings_owner    ON bookings(owner_id);
CREATE INDEX IF NOT EXISTS idx_bookings_slot     ON bookings(slot_id);
CREATE INDEX IF NOT EXISTS idx_slots_date        ON availability_slots(date);

-- Seed default services
INSERT INTO services (name, description, type, duration_minutes, price_pence) VALUES
  ('Dog Walk',          '1-hour group walk in Battersea Park and surrounds.',       'walk',     60,  2500),
  ('Daycare',           'Full-day care with walks, enrichment and rest time.',       'daycare',  480, 5500),
  ('Training Session',  '1-to-1 training session tailored to your dog''s needs.',   'training', 60,  6000),
  ('Puppy Package',     'Intro training + socialisation walk for puppies under 1.',  'training', 90,  7500)
ON CONFLICT DO NOTHING;
