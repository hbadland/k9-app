-- Walk reviews
CREATE TABLE IF NOT EXISTS reviews (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL UNIQUE REFERENCES bookings(id) ON DELETE CASCADE,
  owner_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rating     SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment    TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reviews_owner ON reviews(owner_id);
