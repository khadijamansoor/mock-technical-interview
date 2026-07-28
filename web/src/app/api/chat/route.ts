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
    let action = "probe";
    let reasoning = "";
    let targetGap = "";
    let score: any = null;
    let nextQuestionText: string | null = null;
    let nextQuestionId: string | null = null;

    try {
      // 1. Get current max sequence number
      const seqRes = await client.query(
        "SELECT COALESCE(MAX(sequence_number), 0) as max_seq FROM turns WHERE session_id = $1",
        [sessionId]
      );
      let nextSeq = parseInt(seqRes.rows[0].max_seq) + 1;

      // 2. Insert Candidate's answer
      await client.query(
        "INSERT INTO turns (session_id, question_id, sequence_number, speaker, content) VALUES ($1, $2, $3, $4, $5)",
        [sessionId, currentQuestionId, nextSeq, "candidate", answer]
      );
      nextSeq++;

      // 3. Fetch interview history for context
      const historyRes = await client.query(
        "SELECT speaker, content FROM turns WHERE session_id = $1 ORDER BY sequence_number ASC",
        [sessionId]
      );
      
      const sessionRes = await client.query(
        "SELECT role_track FROM interview_sessions WHERE id = $1",
        [sessionId]
      );
      const roleTrack = sessionRes.rows[0]?.role_track || "general";

      const messages: any[] = historyRes.rows.map((row) => ({
        role: row.speaker === "interviewer" ? "assistant" : "user",
        content: row.content,
      }));

      // 4. Groq Call 1: Structured JSON Decision
      const systemPrompt1 = `You are an expert technical interviewer. Evaluate the candidate's latest answer.
Determine if you should 'probe' (ask a follow-up question because their answer lacked depth or missed a key point), 'next_question' (they answered well and it's time to move on), or 'end' (the interview is complete).
Output strictly in this JSON format:
{
  "action": "probe" | "next_question" | "end",
  "reasoning": "Internal justification",
  "target_gap": "Specific concept to test next, or empty",
  "score": { "correctness": 1-5, "depth": 1-5, "communication": 1-5 }
}`;
      
      const completion1 = await groq.chat.completions.create({
        model: "llama-3.1-8b-instant",
        messages: [{ role: "system", content: systemPrompt1 }, ...messages],
        temperature: 0.2,
        response_format: { type: "json_object" },
      });

      const decisionJson = JSON.parse(completion1.choices[0].message.content || "{}");
      action = decisionJson.action || "probe";
      reasoning = decisionJson.reasoning || "";
      targetGap = decisionJson.target_gap || "";
      score = decisionJson.score || null;

      // 5. If next_question, fetch from Python Backend
      if (action === "next_question") {
        // Get already asked question IDs to avoid duplicates
        const askedRes = await client.query(
          "SELECT DISTINCT question_id FROM turns WHERE session_id = $1 AND question_id IS NOT NULL",
          [sessionId]
        );
        const askedIds = askedRes.rows.map(r => r.question_id);

        try {
          const pyRes = await fetch(`${GRADING_SERVICE_URL}/next-question`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              target_gap: targetGap,
              role_track: roleTrack,
              difficulty: "medium", // hardcoded for now, could be dynamic
              asked_question_ids: askedIds,
            }),
          });
          
          if (pyRes.ok) {
            const pyData = await pyRes.json();
            nextQuestionText = pyData.text;
            nextQuestionId = pyData.id;
          } else {
             // Fallback if no more questions
             action = "end";
          }
        } catch (e) {
          console.error("Failed to fetch next question from Python:", e);
        }
      } else if (action === "end") {
         // Trigger grade asynchronously so we don't block
         fetch(`${GRADING_SERVICE_URL}/grade`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ session_id: sessionId }),
         }).catch(e => console.error("Grade trigger failed:", e));
      }

      // 6. Groq Call 2: Conversational Feedback Stream
      const systemPrompt2 = `You are an expert technical interviewer. You just evaluated the candidate's answer.
Your internal reasoning was: "${reasoning}".
Your decision is to: ${action}.
${targetGap ? `You want to focus on: ${targetGap}` : ""}

Provide short, conversational feedback directly to the candidate based on your reasoning. Keep it to 1-3 sentences.
Do NOT output JSON. Just output the conversational feedback text.`;

      // Return a ReadableStream for SSE
      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        async start(controller) {
          try {
            // First send metadata so the client knows the action and new question ID
            const metadata = {
               type: "metadata",
               action,
               nextQuestionId: nextQuestionId || currentQuestionId,
               eval_json: decisionJson
            };
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(metadata)}\n\n`));

            let fullFeedback = "";
            const streamResponse = await groq.chat.completions.create({
              model: "llama-3.1-8b-instant",
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
            
            // If action is next_question, append the next question text to the stream
            if (action === "next_question" && nextQuestionText) {
               const transitionText = "\n\n" + nextQuestionText;
               fullFeedback += transitionText;
               controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "text", text: transitionText })}\n\n`));
            } else if (action === "end") {
               const endText = "\n\nThank you, we are concluding the interview now. I'm generating your final scorecard.";
               fullFeedback += endText;
               controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "text", text: endText })}\n\n`));
            }

            // Save the interviewer's turn to DB
            await client.query(
              "INSERT INTO turns (session_id, question_id, sequence_number, speaker, content, eval_json) VALUES ($1, $2, $3, $4, $5, $6)",
              [sessionId, nextQuestionId || currentQuestionId, nextSeq, "interviewer", fullFeedback, decisionJson]
            );

            // If action is end, update session status
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

    } catch (dbError) {
      client.release();
      throw dbError;
    }
  } catch (error: any) {
    console.error("API Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
