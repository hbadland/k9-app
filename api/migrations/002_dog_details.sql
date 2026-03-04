-- Extended dog profile fields
ALTER TABLE dogs
  ADD COLUMN IF NOT EXISTS vet_name        TEXT,
  ADD COLUMN IF NOT EXISTS vet_phone       TEXT,
  ADD COLUMN IF NOT EXISTS medical_notes   TEXT,
  ADD COLUMN IF NOT EXISTS behavioural_notes TEXT;

-- Client status + admin notes on the owner
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS status       TEXT NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS admin_notes  TEXT;
