"use server";

import { pool } from "@/lib/db";
import { redirect } from "next/navigation";

export async function createSession(formData: FormData) {
  const role = formData.get("role")?.toString() || "fullstack";
  const topic = formData.get("topic")?.toString() || "general";
  const difficulty = formData.get("difficulty")?.toString() || "medium";

  const client = await pool.connect();
  let sessionId = "";
  let firstQuestionId = "";
  let firstQuestionText = "";

  try {
    // Note: Our DB schema uses `user_id` as NOT NULL in `interview_sessions`.
    // Since we don't have auth yet, we'll create a dummy user or fetch an existing one.
    const userRes = await client.query("SELECT id FROM users LIMIT 1");
    let userId = userRes.rows[0]?.id;

    if (!userId) {
       const newUsr = await client.query("INSERT INTO users (email, target_role) VALUES ($1, $2) RETURNING id", ["test@example.com", role]);
       userId = newUsr.rows[0].id;
    }

    // Create session
    const res = await client.query(
      "INSERT INTO interview_sessions (user_id, role_track) VALUES ($1, $2) RETURNING id",
      [userId, role]
    );
    sessionId = res.rows[0].id;

    // Fetch first question via python grading service
    const GRADING_SERVICE_URL = process.env.GRADING_SERVICE_URL || "http://127.0.0.1:5000";
    const pyRes = await fetch(`${GRADING_SERVICE_URL}/next-question`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        target_gap: topic,
        role_track: role,
        difficulty: difficulty,
        asked_question_ids: [],
      }),
    });

    if (pyRes.ok) {
       const pyData = await pyRes.json();
       firstQuestionId = pyData.id;
       firstQuestionText = pyData.text;

       // Save first question as interviewer turn
       await client.query(
          "INSERT INTO turns (session_id, question_id, sequence_number, speaker, content) VALUES ($1, $2, $3, $4, $5)",
          [sessionId, firstQuestionId, 1, "interviewer", firstQuestionText]
       );
    }
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
