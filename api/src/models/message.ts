import sanitizeHtml from 'sanitize-html';
import { pool } from '../config/db';

function sanitize(text: string | undefined): string | undefined {
  if (!text) return text;
  return sanitizeHtml(text, { allowedTags: [], allowedAttributes: {} });
}

export interface Message {
  id: string;
  booking_id: string;
  sender_id: string;
  sender_role: string;
  body: string | null;
  photo_url: string | null;
  type: string;
  created_at: Date;
}

export const getMessages = async (bookingId: string): Promise<Message[]> => {
  const { rows } = await pool.query(
    'SELECT * FROM messages WHERE booking_id=$1 ORDER BY created_at ASC',
    [bookingId]
  );
  return rows;
};

export const createMessage = async (data: {
  booking_id: string;
  sender_id: string;
  sender_role: string;
  body?: string;
  photo_url?: string;
  type: string;
}): Promise<Message> => {
  const { rows } = await pool.query(
    `INSERT INTO messages (booking_id, sender_id, sender_role, body, photo_url, type)
     VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
    [data.booking_id, data.sender_id, data.sender_role,
     sanitize(data.body) ?? null, data.photo_url ?? null, data.type]
  );
  return rows[0];
};
