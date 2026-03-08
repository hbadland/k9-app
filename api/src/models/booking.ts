import { pool } from '../config/db';
import { sendPush } from '../utils/push';
import { sendEmail } from '../utils/email';
import { bookingReminderEmail } from '../utils/emailTemplates';

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
           d.name AS dog_name, d.avatar_url AS dog_photo_url
    FROM bookings b
    JOIN availability_slots s ON s.id = b.slot_id
    JOIN services sv ON sv.id = s.service_id
    JOIN dogs d ON d.id = b.dog_id
    WHERE b.owner_id = $1
      AND b.status IN ('pending','confirmed','in_progress')
      AND s.date >= CURRENT_DATE
    ORDER BY
      CASE b.status WHEN 'in_progress' THEN 0 ELSE 1 END,
      s.date, s.start_time
    LIMIT 1
  `, [ownerId]);
  return rows[0] ?? null;
};

export const getBookingById = async (id: string, ownerId: string): Promise<Booking | null> => {
  const { rows } = await pool.query(`
    SELECT b.*, sv.name AS service_name, sv.type AS service_type,
           s.date AS slot_date, s.start_time AS slot_start, s.end_time AS slot_end,
           d.name AS dog_name
    FROM bookings b
    JOIN availability_slots s ON s.id = b.slot_id
    JOIN services sv ON sv.id = s.service_id
    JOIN dogs d ON d.id = b.dog_id
    WHERE b.id = $1 AND b.owner_id = $2
  `, [id, ownerId]);
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

export const cancelBooking = async (
  id: string, ownerId: string
): Promise<{ refunded: boolean; booking: Booking | null } | null> => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Fetch booking with slot time so we can check the 24h window
    const { rows: bookingRows } = await client.query(`
      SELECT b.*, s.date AS slot_date, s.start_time AS slot_start,
             sv.name AS service_name, d.name AS dog_name
      FROM bookings b
      JOIN availability_slots s ON s.id = b.slot_id
      JOIN services sv ON sv.id = s.service_id
      JOIN dogs d ON d.id = b.dog_id
      WHERE b.id = $1 AND b.owner_id = $2 AND b.status IN ('pending','confirmed')
    `, [id, ownerId]);

    if (!bookingRows[0]) {
      await client.query('ROLLBACK');
      return null;
    }

    const booking = bookingRows[0] as Booking;
    const slotDatetime = new Date(`${booking.slot_date}T${booking.slot_start}`);
    const hoursUntilWalk = (slotDatetime.getTime() - Date.now()) / (1000 * 60 * 60);
    const eligibleForRefund = hoursUntilWalk > 24;

    await client.query(
      "UPDATE bookings SET status = 'cancelled' WHERE id = $1",
      [id]
    );

    let refunded = false;
    if (eligibleForRefund) {
      const { rows: walletRows } = await client.query(
        'UPDATE wallets SET balance = balance + 1, updated_at = NOW() WHERE user_id = $1 RETURNING id',
        [ownerId]
      );
      if (walletRows[0]) {
        await client.query(
          "INSERT INTO wallet_transactions (wallet_id, amount, type, description) VALUES ($1, 1, 'refund', 'Cancellation refund')",
          [walletRows[0].id]
        );
        refunded = true;
      }
    }

    await client.query('COMMIT');

    // Notify first person on waitlist for this slot (fire-and-forget)
    notifyWaitlist(bookingRows[0].slot_id, booking).catch(() => {});

    return { refunded, booking };
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
};

async function notifyWaitlist(slotId: string, booking: Booking) {
  const { rows } = await pool.query(`
    SELECT sw.user_id, u.email, u.first_name, u.expo_push_token,
           d.name AS dog_name
    FROM slot_waitlist sw
    JOIN users u ON u.id = sw.user_id
    JOIN dogs d ON d.id = sw.dog_id
    WHERE sw.slot_id = $1
    ORDER BY sw.created_at ASC
    LIMIT 1
  `, [slotId]);

  if (!rows[0]) return;

  const { email, first_name, expo_push_token, dog_name } = rows[0];

  const slotLabel = `${booking.slot_date} at ${booking.slot_start}`;
  const message = `A spot just opened up for ${slotLabel}. Book now before it fills!`;

  if (expo_push_token) {
    await sendPush(expo_push_token, 'Spot available!', message);
  }

  await sendEmail({
    to: email,
    subject: `Good news — a spot opened up for ${dog_name}!`,
    html: `<p>Hi ${first_name},</p><p>${message}</p><p>Open the Battersea K9 app to book your spot.</p>`,
  });
}

export const getAllBookings = async (): Promise<Booking[]> => {
  const { rows } = await pool.query(`
    SELECT b.*, sv.name AS service_name, sv.type AS service_type,
           s.date AS slot_date, s.start_time AS slot_start, s.end_time AS slot_end,
           d.name AS dog_name,
           u.email AS owner_email,
           CONCAT(u.first_name, ' ', u.last_name) AS owner_name,
           u.address AS owner_address,
           u.phone AS owner_phone
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
