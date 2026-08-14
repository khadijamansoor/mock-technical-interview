import { pool } from "./db";
import { User } from "@supabase/supabase-js";

/**
 * Ensures the Supabase user exists in our local PostgreSQL `users` table.
 * @param user The authenticated Supabase user.
 * @returns The internal UUID of the user from the `users` table.
 */
export async function getOrCreateAppUser(user: User): Promise<string> {
  if (!user) throw new Error("No user provided");
  
  const client = await pool.connect();
  try {
    // 1. Look up by supabase_user_id
    let res = await client.query(
      "SELECT id FROM users WHERE supabase_user_id = $1", 
      [user.id]
    );

    if (res.rows.length > 0) {
      return res.rows[0].id;
    }

    // 2. Look up by email (in case they existed previously before Supabase)
    // and backfill the supabase_user_id
    if (user.email) {
      res = await client.query(
        "SELECT id FROM users WHERE email = $1",
        [user.email]
      );

      if (res.rows.length > 0) {
        const userId = res.rows[0].id;
        await client.query(
          "UPDATE users SET supabase_user_id = $1 WHERE id = $2",
          [user.id, userId]
        );
        return userId;
      }
    }

    // 3. Otherwise, create a new row
    const insertRes = await client.query(
      `INSERT INTO users (supabase_user_id, email, target_role) 
       VALUES ($1, $2, $3) RETURNING id`,
      [user.id, user.email, "fullstack"] // default target role
    );
    
    return insertRes.rows[0].id;
  } finally {
    client.release();
  }
}
