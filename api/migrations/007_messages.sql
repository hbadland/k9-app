ALTER TABLE users ADD COLUMN IF NOT EXISTS expo_push_token TEXT;

CREATE TABLE IF NOT EXISTS messages (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id  UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  sender_id   UUID NOT NULL REFERENCES users(id),
  sender_role TEXT NOT NULL,   -- 'owner' | 'admin'
  body        TEXT,
  photo_url   TEXT,            -- base64 data URI
  type        TEXT NOT NULL DEFAULT 'message',  -- 'message' | 'update'
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS messages_booking_created ON messages(booking_id, created_at);
