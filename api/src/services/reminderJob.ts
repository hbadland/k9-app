import cron from 'node-cron';
import { pool } from '../config/db';
import { sendEmail } from '../utils/email';
import { bookingReminderEmail } from '../utils/emailTemplates';

export function startReminderJob() {
  // Recurring bookings — runs daily at 07:00 UTC, creates next week's bookings
  cron.schedule('0 7 * * *', async () => {
    try {
      await createRecurringBookings();
    } catch (err) {
      console.error('[reminderJob] Recurring booking error:', err);
    }
  });

  // Run every day at 08:00 UTC
  cron.schedule('0 8 * * *', async () => {
    try {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowStr = tomorrow.toISOString().slice(0, 10);

      const { rows } = await pool.query(`
        SELECT b.id AS booking_id, b.notes,
               u.email, u.first_name,
               d.name AS dog_name,
               sv.name AS service_name,
               s.date AS slot_date, s.start_time AS slot_start
        FROM bookings b
        JOIN users u ON u.id = b.owner_id
        JOIN dogs d ON d.id = b.dog_id
        JOIN availability_slots s ON s.id = b.slot_id
        JOIN services sv ON sv.id = s.service_id
        WHERE s.date = $1
          AND b.status IN ('pending', 'confirmed')
      `, [tomorrowStr]);

      for (const row of rows) {
        try {
          await sendEmail({
            to: row.email,
            subject: `Reminder: ${row.dog_name}'s walk is tomorrow`,
            html: bookingReminderEmail({
              firstName: row.first_name,
              dogName: row.dog_name,
              serviceName: row.service_name,
              slotDate: row.slot_date,
              slotStart: row.slot_start,
              bookingId: row.booking_id,
            }),
          });
        } catch (emailErr) {
          console.error('[reminderJob] Failed to send reminder to', row.email, emailErr);
        }
      }

      if (rows.length > 0) {
        console.log(`[reminderJob] Sent ${rows.length} reminder(s) for ${tomorrowStr}`);
      }
    } catch (err) {
      console.error('[reminderJob] Error:', err);
    }
  });

  console.log('[reminderJob] Scheduled — runs daily at 07:00 UTC (recurring) and 08:00 UTC (reminders)');
}

async function createRecurringBookings() {
  // Find all recurring bookings
  const { rows: recurring } = await pool.query(
    'SELECT * FROM recurring_bookings WHERE active = TRUE'
  );

  if (recurring.length === 0) return;

  // Target date: same weekday next week
  const now = new Date();
  const msPerDay = 86_400_000;

  let created = 0;
  for (const rb of recurring) {
    // Find the next occurrence of rb.day_of_week (0=Sun, 6=Sat)
    const daysAhead = ((rb.day_of_week - now.getDay() + 7) % 7) || 7;
    const targetDate = new Date(now.getTime() + daysAhead * msPerDay);
    const dateStr = targetDate.toISOString().slice(0, 10);

    // Find a matching available slot
    const { rows: slots } = await pool.query(`
      SELECT s.id, s.capacity,
             COUNT(b.id) FILTER (WHERE b.status != 'cancelled') AS booked
      FROM availability_slots s
      LEFT JOIN bookings b ON b.slot_id = s.id
      WHERE s.date = $1 AND s.start_time = $2
      GROUP BY s.id
      HAVING COUNT(b.id) FILTER (WHERE b.status != 'cancelled') < s.capacity
      LIMIT 1
    `, [dateStr, rb.slot_time]);

    if (!slots[0]) continue; // no available slot that day

    // Check user has credits
    const { rows: wallet } = await pool.query(
      'SELECT balance, id FROM wallets WHERE user_id = $1', [rb.owner_id]
    );
    if (!wallet[0] || wallet[0].balance < 1) continue;

    // Check booking doesn't already exist for this recurring entry on that date
    const { rows: existing } = await pool.query(`
      SELECT 1 FROM bookings b
      JOIN availability_slots s ON s.id = b.slot_id
      WHERE b.owner_id = $1 AND b.dog_id = $2 AND s.date = $3
        AND b.status != 'cancelled'
    `, [rb.owner_id, rb.dog_id, dateStr]);

    if (existing.length > 0) continue;

    // Create booking and debit credit atomically
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(
        'UPDATE wallets SET balance = balance - 1, updated_at = NOW() WHERE id = $1',
        [wallet[0].id]
      );
      await client.query(
        "INSERT INTO wallet_transactions (wallet_id, amount, type, description) VALUES ($1, -1, 'usage', 'Recurring walk booking')",
        [wallet[0].id]
      );
      await client.query(
        'INSERT INTO bookings (owner_id, dog_id, slot_id, notes) VALUES ($1,$2,$3,$4)',
        [rb.owner_id, rb.dog_id, slots[0].id, 'Auto-created from recurring booking']
      );
      await client.query('COMMIT');
      created++;
    } catch {
      await client.query('ROLLBACK');
    } finally {
      client.release();
    }
  }

  if (created > 0) {
    console.log(`[reminderJob] Created ${created} recurring booking(s)`);
  }
}
