"use server";

import { pool } from "@/lib/db";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase-server";
import { getOrCreateAppUser } from "@/lib/get-or-create-app-user";

export async function createSession(formData: FormData) {
  const roleTrack = formData.get("role_track")?.toString() || "fullstack";
  const roundTypeStr = formData.get("round_type")?.toString();
  const roundType = roundTypeStr ? roundTypeStr : null;
  const difficulty = formData.get("difficulty")?.toString() || "medium";

  const supabase = await createClient();
  const { data: { user: supabaseUser } } = await supabase.auth.getUser();
  if (!supabaseUser) throw new Error("Unauthorized");
  
  const userId = await getOrCreateAppUser(supabaseUser);
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

    // 2. Fetch the user's active resume and JD
    const userRes = await client.query(
      "SELECT active_resume_id, active_jd_id FROM users WHERE id = $1", 
      [userId]
    );
    const activeResumeId = userRes.rows[0]?.active_resume_id;
    const activeJdId = userRes.rows[0]?.active_jd_id || null; // JD is optional

    if (!activeResumeId) {
      throw new Error("Add a resume before starting an interview.");
    }

    // 3. Create session in 'greeting' state, including resume_id and job_description_id (migration 009)
    const res = await client.query(
      `INSERT INTO interview_sessions (user_id, role_track, round_type, status, resume_id, job_description_id) 
       VALUES ($1, $2, $3, 'greeting', $4, $5) RETURNING id`,
      [userId, roleTrack, roundType, activeResumeId, activeJdId]
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
