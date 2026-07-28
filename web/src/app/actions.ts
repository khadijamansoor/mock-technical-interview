"use server";

import { pool } from "@/lib/db";
import { redirect } from "next/navigation";

export async function createSession(formData: FormData) {
  const role = formData.get("role")?.toString() || "fullstack";
  const difficulty = formData.get("difficulty")?.toString() || "medium";

  const client = await pool.connect();
  let sessionId = "";

  try {
    // Get or create a dummy user (no auth yet)
    const userRes = await client.query("SELECT id FROM users LIMIT 1");
    let userId = userRes.rows[0]?.id;

    if (!userId) {
       const newUsr = await client.query("INSERT INTO users (email, target_role) VALUES ($1, $2) RETURNING id", ["test@example.com", role]);
       userId = newUsr.rows[0].id;
    }

    // Create session in 'greeting' state — first question comes after greeting exchange
    const res = await client.query(
      "INSERT INTO interview_sessions (user_id, role_track, status) VALUES ($1, $2, 'greeting') RETURNING id",
      [userId, role]
    );
    sessionId = res.rows[0].id;

    // Insert Jasmine's greeting as the first turn
    const greeting = "Hi there! I'm Jasmine, and I'll be your interviewer today. Before we dive in, could you tell me your name and how you're doing?";
    await client.query(
      "INSERT INTO turns (session_id, sequence_number, speaker, content) VALUES ($1, $2, $3, $4)",
      [sessionId, 1, "interviewer", greeting]
    );
  } catch (error) {
    console.error("Error creating session:", error);
    throw error;
  } finally {
    client.release();
  }

  if (sessionId) {
    redirect(`/interview/${sessionId}`);
  }
}
