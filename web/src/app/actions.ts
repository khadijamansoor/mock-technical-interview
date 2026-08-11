"use server";

import { pool } from "@/lib/db";
import { redirect } from "next/navigation";

export async function createSession(formData: FormData) {
  const roleTrack = formData.get("role_track")?.toString() || "fullstack";
  const roundTypeStr = formData.get("round_type")?.toString();
  const roundType = roundTypeStr ? roundTypeStr : null;
  const difficulty = formData.get("difficulty")?.toString() || "medium";

  const client = await pool.connect();
  let sessionId = "";

  try {
    // 1. Validate that the selected track/round_type has at least 1 seeded question
    const countQuery = roundType 
      ? "SELECT COUNT(*) FROM questions WHERE role_track = $1 AND round_type = $2"
      : "SELECT COUNT(*) FROM questions WHERE role_track = $1 AND round_type IS NULL";
    
    const countParams = roundType ? [roleTrack, roundType] : [roleTrack];
    const countRes = await client.query(countQuery, countParams);
    
    if (parseInt(countRes.rows[0].count, 10) === 0) {
      throw new Error(`Cannot start interview: No seeded questions found for track '${roleTrack}'${roundType ? ` and round type '${roundType}'` : ''}.`);
    }
    // Get or create a dummy user (no auth yet)
    const userRes = await client.query("SELECT id FROM users LIMIT 1");
    let userId = userRes.rows[0]?.id;

    if (!userId) {
       const newUsr = await client.query("INSERT INTO users (email, target_role) VALUES ($1, $2) RETURNING id", ["test@example.com", roleTrack]);
       userId = newUsr.rows[0].id;
    }

    // Create session in 'greeting' state
    const res = await client.query(
      "INSERT INTO interview_sessions (user_id, role_track, round_type, status) VALUES ($1, $2, $3, 'greeting') RETURNING id",
      [userId, roleTrack, roundType]
    );
    sessionId = res.rows[0].id;


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

export async function startGreeting(sessionId: string) {
  const client = await pool.connect();
  try {
    const greeting = "Hi there! I'm Jasmine, and I'll be your interviewer today. Before we dive in, could you tell me your name and how you're doing?";
    // Only insert if it doesn't already exist (e.g. from page refresh)
    const existing = await client.query("SELECT id FROM turns WHERE session_id = $1 AND sequence_number = 1", [sessionId]);
    if (existing.rows.length === 0) {
      await client.query(
        "INSERT INTO turns (session_id, sequence_number, speaker, content) VALUES ($1, $2, $3, $4)",
        [sessionId, 1, "interviewer", greeting]
      );
    }
    return greeting;
  } catch (error) {
    console.error("Error starting greeting:", error);
    throw error;
  } finally {
    client.release();
  }
}
