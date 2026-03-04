import { pool } from '../config/db';

export interface Dog {
  id: string;
  owner_id: string;
  name: string;
  breed: string | null;
  age_months: number | null;
  notes: string | null;
  vet_name: string | null;
  vet_phone: string | null;
  medical_notes: string | null;
  behavioural_notes: string | null;
  collar_id: string | null;
  avatar_url: string | null;
  created_at: Date;
}

export const getDogsByOwner = async (ownerId: string): Promise<Dog[]> => {
  const { rows } = await pool.query(
    'SELECT * FROM dogs WHERE owner_id = $1 ORDER BY created_at',
    [ownerId]
  );
  return rows;
};

export const createDog = async (ownerId: string, data: Partial<Dog>): Promise<Dog> => {
  const { rows } = await pool.query(
    `INSERT INTO dogs
       (owner_id, name, breed, age_months, notes, vet_name, vet_phone, medical_notes, behavioural_notes)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
    [
      ownerId, data.name,
      data.breed ?? null, data.age_months ?? null, data.notes ?? null,
      data.vet_name ?? null, data.vet_phone ?? null,
      data.medical_notes ?? null, data.behavioural_notes ?? null,
    ]
  );
  return rows[0];
};

export const updateDog = async (id: string, ownerId: string, data: Partial<Dog>): Promise<Dog | null> => {
  const { rows } = await pool.query(
    `UPDATE dogs SET
       name               = COALESCE($1,  name),
       breed              = COALESCE($2,  breed),
       age_months         = COALESCE($3,  age_months),
       notes              = COALESCE($4,  notes),
       vet_name           = COALESCE($5,  vet_name),
       vet_phone          = COALESCE($6,  vet_phone),
       medical_notes      = COALESCE($7,  medical_notes),
       behavioural_notes  = COALESCE($8,  behavioural_notes)
     WHERE id = $9 AND owner_id = $10 RETURNING *`,
    [
      data.name, data.breed, data.age_months, data.notes,
      data.vet_name, data.vet_phone, data.medical_notes, data.behavioural_notes,
      id, ownerId,
    ]
  );
  return rows[0] ?? null;
};

export const deleteDog = async (id: string, ownerId: string): Promise<boolean> => {
  const { rowCount } = await pool.query(
    'DELETE FROM dogs WHERE id = $1 AND owner_id = $2',
    [id, ownerId]
  );
  return (rowCount ?? 0) > 0;
};

export const getAllClientsWithDogs = async () => {
  const { rows } = await pool.query(`
    SELECT u.id, u.email, u.first_name, u.last_name, u.phone, u.address,
           u.status, u.admin_notes, u.created_at,
           json_agg(d.* ORDER BY d.created_at) FILTER (WHERE d.id IS NOT NULL) AS dogs
    FROM users u
    LEFT JOIN dogs d ON d.owner_id = u.id
    WHERE u.role = 'owner'
    GROUP BY u.id
    ORDER BY u.created_at DESC
  `);
  return rows;
};

export const getClientById = async (id: string) => {
  const { rows } = await pool.query(`
    SELECT u.id, u.email, u.first_name, u.last_name, u.phone, u.address,
           u.status, u.admin_notes, u.created_at,
           json_agg(d.* ORDER BY d.created_at) FILTER (WHERE d.id IS NOT NULL) AS dogs
    FROM users u
    LEFT JOIN dogs d ON d.owner_id = u.id
    WHERE u.id = $1 AND u.role = 'owner'
    GROUP BY u.id
  `, [id]);
  return rows[0] ?? null;
};
