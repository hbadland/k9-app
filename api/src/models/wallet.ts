import { pool } from '../config/db';

export interface Wallet {
  id: string; user_id: string; balance: number; updated_at: Date;
}

export interface WalletTransaction {
  id: string; wallet_id: string; amount: number; type: string;
  description: string | null; stripe_reference: string | null; created_at: Date;
}

export const getOrCreateWallet = async (userId: string): Promise<Wallet> => {
  await pool.query(
    'INSERT INTO wallets (user_id) VALUES ($1) ON CONFLICT (user_id) DO NOTHING',
    [userId]
  );
  const { rows } = await pool.query('SELECT * FROM wallets WHERE user_id = $1', [userId]);
  return rows[0];
};

export const creditWallet = async (
  userId: string, amount: number, type: string,
  description: string, stripeRef?: string
): Promise<Wallet> => {
  const wallet = await getOrCreateWallet(userId);
  const { rows } = await pool.query(
    'UPDATE wallets SET balance = balance + $1, updated_at = NOW() WHERE id = $2 RETURNING *',
    [amount, wallet.id]
  );
  await pool.query(
    'INSERT INTO wallet_transactions (wallet_id, amount, type, description, stripe_reference) VALUES ($1,$2,$3,$4,$5)',
    [wallet.id, amount, type, description, stripeRef ?? null]
  );
  return rows[0];
};

export const getWalletWithTransactions = async (userId: string): Promise<Wallet & { transactions: WalletTransaction[] }> => {
  const wallet = await getOrCreateWallet(userId);
  const { rows: transactions } = await pool.query(
    'SELECT * FROM wallet_transactions WHERE wallet_id = $1 ORDER BY created_at DESC LIMIT 20',
    [wallet.id]
  );
  return { ...wallet, transactions };
};
