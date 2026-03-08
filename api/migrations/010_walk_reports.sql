-- Walk reports (auto-generated on completion)
CREATE TABLE IF NOT EXISTS walk_reports (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id       UUID NOT NULL UNIQUE REFERENCES bookings(id) ON DELETE CASCADE,
  distance_metres  NUMERIC(10,2),
  duration_seconds INTEGER,
  photo_urls       JSONB NOT NULL DEFAULT '[]',
  notes            TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Recurring bookings
CREATE TABLE IF NOT EXISTS recurring_bookings (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  dog_id       UUID NOT NULL REFERENCES dogs(id) ON DELETE CASCADE,
  service_id   UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  day_of_week  SMALLINT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  slot_time    TIME NOT NULL,
  active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Slot waitlist
CREATE TABLE IF NOT EXISTS slot_waitlist (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slot_id    UUID NOT NULL REFERENCES availability_slots(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  dog_id     UUID NOT NULL REFERENCES dogs(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(slot_id, user_id)
);
