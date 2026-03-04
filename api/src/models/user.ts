import { pool } from '../config/db';

export interface User {
  id: string;
  email: string;
  password_hash: string;
  role: string;
  status: string;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  address: string | null;
  admin_notes: string | null;
  stripe_customer_id: string | null;
  created_at: Date;
}

export const findByEmail = async (email: string): Promise<User | null> => {
  const { rows } = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
  return rows[0] ?? null;
};

export const findById = async (id: string): Promise<User | null> => {
  const { rows } = await pool.query('SELECT * FROM users WHERE id = $1', [id]);
  return rows[0] ?? null;
};

export const createUser = async (
  email: string,
  passwordHash: string,
  firstName?: string,
  lastName?: string
): Promise<User> => {
  const { rows } = await pool.query(
    `INSERT INTO users (email, password_hash, first_name, last_name)
     VALUES ($1, $2, $3, $4) RETURNING *`,
    [email, passwordHash, firstName ?? null, lastName ?? null]
  );
  return rows[0];
};

export const updateUser = async (id: string, data: {
  first_name?: string;
  last_name?: string;
  phone?: string;
  address?: string;
}): Promise<User | null> => {
  const { rows } = await pool.query(
    `UPDATE users SET
       first_name = COALESCE($1, first_name),
       last_name  = COALESCE($2, last_name),
       phone      = COALESCE($3, phone),
       address    = COALESCE($4, address)
     WHERE id = $5 RETURNING *`,
    [data.first_name, data.last_name, data.phone, data.address, id]
  );
  return rows[0] ?? null;
};

export const setClientStatus = async (id: string, status: string): Promise<void> => {
  await pool.query('UPDATE users SET status = $1 WHERE id = $2', [status, id]);
};

export const setAdminNotes = async (id: string, notes: string): Promise<void> => {
  await pool.query('UPDATE users SET admin_notes = $1 WHERE id = $2', [notes, id]);
};

export const saveRefreshToken = async (userId: string, tokenHash: string) => {
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  await pool.query(
    'INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3)',
    [userId, tokenHash, expiresAt]
  );
};

export const findRefreshToken = async (tokenHash: string) => {
  const { rows } = await pool.query(
    'SELECT * FROM refresh_tokens WHERE token_hash = $1 AND expires_at > NOW()',
    [tokenHash]
  );
  return rows[0] ?? null;
};

export const deleteRefreshToken = async (tokenHash: string) => {
  await pool.query('DELETE FROM refresh_tokens WHERE token_hash = $1', [tokenHash]);
};
