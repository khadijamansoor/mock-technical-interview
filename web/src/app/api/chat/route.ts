import { NextRequest, NextResponse } from "next/server";
import { Groq } from "groq-sdk";
import { pool } from "@/lib/db";

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

const GRADING_SERVICE_URL = process.env.GRADING_SERVICE_URL || "http://127.0.0.1:5000";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { sessionId, answer, currentQuestionId } = body;

    if (!sessionId || !answer) {
      return NextResponse.json({ error: "Missing sessionId or answer" }, { status: 400 });
    }

    const client = await pool.connect();

    try {
      // Fetch session info
      const sessionRes = await client.query(
        "SELECT role_track, status, candidate_name FROM interview_sessions WHERE id = $1",
        [sessionId]
      );
      const session = sessionRes.rows[0];
      if (!session) {
        client.release();
        return NextResponse.json({ error: "Session not found" }, { status: 404 });
      }

      const roleTrack = session.role_track || "general";
      const sessionStatus = session.status;
      let candidateName = session.candidate_name || "";

      // Get current max sequence number
      const seqRes = await client.query(
        "SELECT COALESCE(MAX(sequence_number), 0) as max_seq FROM turns WHERE session_id = $1",
        [sessionId]
      );
      let nextSeq = parseInt(seqRes.rows[0].max_seq) + 1;

      // Insert candidate's message
      await client.query(
        "INSERT INTO turns (session_id, question_id, sequence_number, speaker, content) VALUES ($1, $2, $3, $4, $5)",
        [sessionId, currentQuestionId || null, nextSeq, "candidate", answer]
      );
      nextSeq++;

      // ─── GREETING STATE ───────────────────────────────────────────
      if (sessionStatus === "greeting") {
        return await handleGreeting(client, sessionId, answer, nextSeq, roleTrack);
      }

      // ─── INTERVIEW STATE (in_progress) ────────────────────────────
      return await handleInterview(client, sessionId, answer, currentQuestionId, nextSeq, roleTrack, candidateName);

    } catch (dbError) {
      client.release();
      throw dbError;
    }
  } catch (error: any) {
    console.error("API Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// ─── GREETING HANDLER ─────────────────────────────────────────────────
async function handleGreeting(
  client: any,
  sessionId: string,
  answer: string,
  nextSeq: number,
  roleTrack: string
) {
  const encoder = new TextEncoder();

  // Extract candidate name via lightweight Groq call
  const nameExtraction = await groq.chat.completions.create({
    model: "openai/gpt-oss-20b",
    messages: [{
      role: "user",
      content: `Extract just the person's first name from this text. If no name is found, use "there" as a fallback. Return JSON: {"name": "..."}\n\nText: "${answer}"`
    }],
    temperature: 0,
    response_format: { type: "json_object" },
  });

  let candidateName = "there";
  try {
    const parsed = JSON.parse(nameExtraction.choices[0].message.content || "{}");
    candidateName = parsed.name || "there";
  } catch { /* fallback to "there" */ }

  // Store name and transition to in_progress
  await client.query(
    "UPDATE interview_sessions SET candidate_name = $1, status = 'in_progress' WHERE id = $2",
    [candidateName === "there" ? null : candidateName, sessionId]
  );

  // Fetch first real question from Python backend
  let firstQuestionText = "";
  let firstQuestionId: string | null = null;

  try {
    const pyRes = await fetch(`${GRADING_SERVICE_URL}/next-question`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        target_gap: "",
        role_track: roleTrack,
        difficulty: "medium",
        asked_question_ids: [],
      }),
    });

    if (pyRes.ok) {
      const pyData = await pyRes.json();
      firstQuestionText = pyData.text;
      firstQuestionId = pyData.id;
    }
  } catch (e) {
    console.error("Failed to fetch first question:", e);
  }

  // Stream Jasmine's greeting acknowledgment + first question
  const stream = new ReadableStream({
    async start(controller) {
      try {
        const metadata = {
          type: "metadata",
          action: "greeting_done",
          nextQuestionId: firstQuestionId,
          eval_json: null,
        };
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(metadata)}\n\n`));

        // Generate warm acknowledgment
        const ackPrompt = `You are Jasmine, a friendly but rigorous technical interviewer. The candidate just introduced themselves. Their message was: "${answer}".
${candidateName !== "there" ? `Their name is ${candidateName}.` : ""}

Write a warm, brief (1-2 sentence) acknowledgment. Then smoothly transition to the first interview question by saying something like "Let's get started!" and present this question:

"${firstQuestionText}"

Do NOT output JSON. Just output natural conversational text. Keep the total response under 4 sentences.`;

        let fullResponse = "";
        const streamResponse = await groq.chat.completions.create({
          model: "openai/gpt-oss-20b",
          messages: [{ role: "user", content: ackPrompt }],
          temperature: 0.7,
          stream: true,
        });

        for await (const chunk of streamResponse) {
          const text = chunk.choices[0]?.delta?.content || "";
          if (text) {
            fullResponse += text;
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "text", text })}\n\n`));
          }
        }

        // Save turn to DB
        await client.query(
          "INSERT INTO turns (session_id, question_id, sequence_number, speaker, content) VALUES ($1, $2, $3, $4, $5)",
          [sessionId, firstQuestionId, nextSeq, "interviewer", fullResponse]
        );

        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
      } catch (e) {
        console.error("Greeting stream error:", e);
        controller.error(e);
      } finally {
        client.release();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}

// ─── INTERVIEW HANDLER ───────────────────────────────────────────────
async function handleInterview(
  client: any,
  sessionId: string,
  answer: string,
  currentQuestionId: string | null,
  nextSeq: number,
  roleTrack: string,
  candidateName: string
) {
  const encoder = new TextEncoder();
  const nameClause = candidateName ? `The candidate's name is ${candidateName}. You may address them by name occasionally where natural, but not in every message.` : "";

  let action = "probe";
  let reasoning = "";
  let targetGap = "";
  let nextQuestionText: string | null = null;
  let nextQuestionId: string | null = null;

  // Fetch interview history
  const historyRes = await client.query(
    "SELECT speaker, content FROM turns WHERE session_id = $1 ORDER BY sequence_number ASC",
    [sessionId]
  );

  const messages: any[] = historyRes.rows.map((row: any) => ({
    role: row.speaker === "interviewer" ? "assistant" : "user",
    content: row.content,
  }));

  // Groq Call 1: Structured JSON Decision
  const systemPrompt1 = `You are Jasmine, a friendly but rigorous technical interviewer. ${nameClause}
Evaluate the candidate's latest answer.
Determine if you should 'probe' (ask a follow-up question because their answer lacked depth or missed a key point), 'next_question' (they answered well and it's time to move on), or 'end' (the interview is complete — use this after 4-6 questions have been covered).
Output strictly in this JSON format:
{
  "action": "probe" | "next_question" | "end",
  "reasoning": "Internal justification",
  "target_gap": "Specific concept to test next, or empty",
  "score": { "correctness": 1-5, "depth": 1-5, "communication": 1-5 }
}`;

  const completion1 = await groq.chat.completions.create({
    model: "openai/gpt-oss-20b",
    messages: [{ role: "system", content: systemPrompt1 }, ...messages],
    temperature: 0.2,
    response_format: { type: "json_object" },
  });

  const decisionJson = JSON.parse(completion1.choices[0].message.content || "{}");
  action = decisionJson.action || "probe";
  reasoning = decisionJson.reasoning || "";
  targetGap = decisionJson.target_gap || "";

  // If next_question, fetch from Python Backend
  if (action === "next_question") {
    const askedRes = await client.query(
      "SELECT DISTINCT question_id FROM turns WHERE session_id = $1 AND question_id IS NOT NULL",
      [sessionId]
    );
    const askedIds = askedRes.rows.map((r: any) => r.question_id);

    try {
      const pyRes = await fetch(`${GRADING_SERVICE_URL}/next-question`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          target_gap: targetGap,
          role_track: roleTrack,
          difficulty: "medium",
          asked_question_ids: askedIds,
        }),
      });

      if (pyRes.ok) {
        const pyData = await pyRes.json();
        nextQuestionText = pyData.text;
        nextQuestionId = pyData.id;
      } else {
        action = "end";
      }
    } catch (e) {
      console.error("Failed to fetch next question from Python:", e);
    }
  } else if (action === "end") {
    // Trigger grade asynchronously
    fetch(`${GRADING_SERVICE_URL}/grade`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ session_id: sessionId }),
    }).catch(e => console.error("Grade trigger failed:", e));
  }

  // Groq Call 2: Conversational Feedback Stream
  const systemPrompt2 = `You are Jasmine, a friendly but rigorous technical interviewer. ${nameClause}
You just evaluated the candidate's answer.
Your internal reasoning was: "${reasoning}".
Your decision is to: ${action}.
${targetGap ? `You want to focus on: ${targetGap}` : ""}

Provide short, conversational feedback directly to the candidate based on your reasoning. Keep it to 1-3 sentences.
Do NOT output JSON. Just output the conversational feedback text.`;

  const stream = new ReadableStream({
    async start(controller) {
      try {
        const metadata = {
          type: "metadata",
          action,
          nextQuestionId: nextQuestionId || currentQuestionId,
          eval_json: decisionJson,
        };
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(metadata)}\n\n`));

        let fullFeedback = "";
        const streamResponse = await groq.chat.completions.create({
          model: "openai/gpt-oss-20b",
          messages: [{ role: "system", content: systemPrompt2 }, ...messages],
          temperature: 0.7,
          stream: true,
        });

        for await (const chunk of streamResponse) {
          const text = chunk.choices[0]?.delta?.content || "";
          if (text) {
            fullFeedback += text;
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "text", text })}\n\n`));
          }
        }

        // Append next question or end message
        if (action === "next_question" && nextQuestionText) {
          const transitionText = "\n\n" + nextQuestionText;
          fullFeedback += transitionText;
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "text", text: transitionText })}\n\n`));
        } else if (action === "end") {
          const endText = "\n\nThank you so much for your time today! I'm generating your final scorecard now.";
          fullFeedback += endText;
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "text", text: endText })}\n\n`));
        }

        // Save interviewer turn to DB
        await client.query(
          "INSERT INTO turns (session_id, question_id, sequence_number, speaker, content, eval_json) VALUES ($1, $2, $3, $4, $5, $6)",
          [sessionId, nextQuestionId || currentQuestionId, nextSeq, "interviewer", fullFeedback, decisionJson]
        );

        // If end, update session status
        if (action === "end") {
          await client.query("UPDATE interview_sessions SET status = 'completed', ended_at = now() WHERE id = $1", [sessionId]);
        }

        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
      } catch (e) {
        console.error("Stream error:", e);
        controller.error(e);
      } finally {
        client.release();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
