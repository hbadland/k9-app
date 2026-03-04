import { pool } from '../config/db';

export interface Service {
  id: string; name: string; description: string | null;
  type: string; duration_minutes: number; price_pence: number; active: boolean;
}

export interface Slot {
  id: string; service_id: string; date: string; start_time: string;
  end_time: string; capacity: number;
  // joined
  service_name?: string; service_type?: string; price_pence?: number;
  booked_count?: number;
}

export interface Booking {
  id: string; owner_id: string; dog_id: string; slot_id: string;
  status: string; notes: string | null; created_at: Date;
  // joined
  service_name?: string; service_type?: string;
  slot_date?: string; slot_start?: string; slot_end?: string;
  dog_name?: string; owner_email?: string; owner_name?: string;
}

// ── Services ──────────────────────────────────────────────────────────────

export const getServices = async (): Promise<Service[]> => {
  const { rows } = await pool.query(
    'SELECT * FROM services WHERE active = TRUE ORDER BY type, name'
  );
  return rows;
};

// ── Slots ─────────────────────────────────────────────────────────────────

export const getSlots = async (date?: string): Promise<Slot[]> => {
  const where = date ? 'WHERE s.date = $1' : '';
  const params = date ? [date] : [];
  const { rows } = await pool.query(`
    SELECT s.*, sv.name AS service_name, sv.type AS service_type, sv.price_pence,
           COUNT(b.id) FILTER (WHERE b.status != 'cancelled') AS booked_count
    FROM availability_slots s
    JOIN services sv ON sv.id = s.service_id
    LEFT JOIN bookings b ON b.slot_id = s.id
    ${where}
    GROUP BY s.id, sv.name, sv.type, sv.price_pence
    ORDER BY s.date, s.start_time
  `, params);
  return rows;
};

export const getSlotsInRange = async (from: string, to: string): Promise<Slot[]> => {
  const { rows } = await pool.query(`
    SELECT s.*, sv.name AS service_name, sv.type AS service_type, sv.price_pence,
           COUNT(b.id) FILTER (WHERE b.status != 'cancelled') AS booked_count
    FROM availability_slots s
    JOIN services sv ON sv.id = s.service_id
    LEFT JOIN bookings b ON b.slot_id = s.id
    WHERE s.date BETWEEN $1 AND $2
    GROUP BY s.id, sv.name, sv.type, sv.price_pence
    ORDER BY s.date, s.start_time
  `, [from, to]);
  return rows;
};

export const createSlot = async (data: {
  service_id: string; date: string; start_time: string;
  end_time: string; capacity: number;
}): Promise<Slot> => {
  const { rows } = await pool.query(
    `INSERT INTO availability_slots (service_id, date, start_time, end_time, capacity)
     VALUES ($1,$2,$3,$4,$5) RETURNING *`,
    [data.service_id, data.date, data.start_time, data.end_time, data.capacity]
  );
  return rows[0];
};

export const deleteSlot = async (id: string): Promise<boolean> => {
  const { rowCount } = await pool.query(
    'DELETE FROM availability_slots WHERE id = $1', [id]
  );
  return (rowCount ?? 0) > 0;
};

// ── Bookings ──────────────────────────────────────────────────────────────

export const getBookingsByOwner = async (ownerId: string): Promise<Booking[]> => {
  const { rows } = await pool.query(`
    SELECT b.*, sv.name AS service_name, sv.type AS service_type,
           s.date AS slot_date, s.start_time AS slot_start, s.end_time AS slot_end,
           d.name AS dog_name
    FROM bookings b
    JOIN availability_slots s ON s.id = b.slot_id
    JOIN services sv ON sv.id = s.service_id
    JOIN dogs d ON d.id = b.dog_id
    WHERE b.owner_id = $1
    ORDER BY s.date DESC, s.start_time DESC
  `, [ownerId]);
  return rows;
};

export const getNextBooking = async (ownerId: string): Promise<Booking | null> => {
  const { rows } = await pool.query(`
    SELECT b.*, sv.name AS service_name, sv.type AS service_type,
           s.date AS slot_date, s.start_time AS slot_start, s.end_time AS slot_end,
           d.name AS dog_name
    FROM bookings b
    JOIN availability_slots s ON s.id = b.slot_id
    JOIN services sv ON sv.id = s.service_id
    JOIN dogs d ON d.id = b.dog_id
    WHERE b.owner_id = $1
      AND b.status IN ('pending','confirmed')
      AND s.date >= CURRENT_DATE
    ORDER BY s.date, s.start_time
    LIMIT 1
  `, [ownerId]);
  return rows[0] ?? null;
};

export const createBooking = async (data: {
  owner_id: string; dog_id: string; slot_id: string; notes?: string;
}): Promise<Booking> => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Verify dog belongs to this owner
    const { rowCount: dogCheck } = await client.query(
      'SELECT 1 FROM dogs WHERE id = $1 AND owner_id = $2',
      [data.dog_id, data.owner_id]
    );
    if (!dogCheck) throw new Error('DOG_NOT_FOUND');

    // Debit 1 credit atomically (balance check built in via CHECK constraint + WHERE)
    const { rows: walletRows } = await client.query(
      'UPDATE wallets SET balance = balance - 1, updated_at = NOW() WHERE user_id = $1 AND balance >= 1 RETURNING id',
      [data.owner_id]
    );
    if (!walletRows[0]) throw new Error('INSUFFICIENT_CREDITS');
    await client.query(
      "INSERT INTO wallet_transactions (wallet_id, amount, type, description) VALUES ($1, -1, 'usage', 'Walk booking')",
      [walletRows[0].id]
    );

    // Check slot capacity
    const { rows: cap } = await client.query(`
      SELECT s.capacity, COUNT(b.id) FILTER (WHERE b.status != 'cancelled') AS booked
      FROM availability_slots s
      LEFT JOIN bookings b ON b.slot_id = s.id
      WHERE s.id = $1
      GROUP BY s.capacity
    `, [data.slot_id]);
    if (!cap[0] || parseInt(cap[0].booked) >= cap[0].capacity) throw new Error('SLOT_FULL');

    // Create booking
    const { rows } = await client.query(
      'INSERT INTO bookings (owner_id, dog_id, slot_id, notes) VALUES ($1,$2,$3,$4) RETURNING *',
      [data.owner_id, data.dog_id, data.slot_id, data.notes ?? null]
    );

    await client.query('COMMIT');
    return rows[0];
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
};

export const cancelBooking = async (id: string, ownerId: string): Promise<boolean> => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rowCount } = await client.query(
      `UPDATE bookings SET status = 'cancelled'
       WHERE id = $1 AND owner_id = $2 AND status IN ('pending','confirmed')`,
      [id, ownerId]
    );

    if ((rowCount ?? 0) > 0) {
      // Refund 1 credit
      const { rows: walletRows } = await client.query(
        'UPDATE wallets SET balance = balance + 1, updated_at = NOW() WHERE user_id = $1 RETURNING id',
        [ownerId]
      );
      if (walletRows[0]) {
        await client.query(
          "INSERT INTO wallet_transactions (wallet_id, amount, type, description) VALUES ($1, 1, 'refund', 'Booking cancelled')",
          [walletRows[0].id]
        );
      }
    }

    await client.query('COMMIT');
    return (rowCount ?? 0) > 0;
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
};

export const getAllBookings = async (): Promise<Booking[]> => {
  const { rows } = await pool.query(`
    SELECT b.*, sv.name AS service_name, sv.type AS service_type,
           s.date AS slot_date, s.start_time AS slot_start, s.end_time AS slot_end,
           d.name AS dog_name,
           u.email AS owner_email,
           CONCAT(u.first_name, ' ', u.last_name) AS owner_name
    FROM bookings b
    JOIN availability_slots s ON s.id = b.slot_id
    JOIN services sv ON sv.id = s.service_id
    JOIN dogs d ON d.id = b.dog_id
    JOIN users u ON u.id = b.owner_id
    ORDER BY s.date DESC, s.start_time DESC
  `);
  return rows;
};

export const updateBookingStatus = async (id: string, status: string): Promise<boolean> => {
  const { rowCount } = await pool.query(
    'UPDATE bookings SET status = $1 WHERE id = $2', [status, id]
  );
  return (rowCount ?? 0) > 0;
};
