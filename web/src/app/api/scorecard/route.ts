import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";

export async function GET(req: NextRequest) {
  const sessionId = req.nextUrl.searchParams.get("sessionId");

  if (!sessionId) {
    return NextResponse.json({ error: "Missing sessionId" }, { status: 400 });
  }

  const client = await pool.connect();

  try {
    const res = await client.query(
      `SELECT s.rubric_scores, s.overall_feedback, s.generated_at, 
              i.candidate_name, i.role_track
       FROM scorecards s
       JOIN interview_sessions i ON i.id = s.session_id
       WHERE s.session_id = $1`,
      [sessionId]
    );

    if (res.rows.length === 0) {
      return NextResponse.json({ error: "Scorecard not ready" }, { status: 404 });
    }

    const row = res.rows[0];
    return NextResponse.json({
      rubric_scores: row.rubric_scores,
      overall_feedback: row.overall_feedback,
      generated_at: row.generated_at,
      candidate_name: row.candidate_name,
      role_track: row.role_track,
    });
  } finally {
    client.release();
  }
}
