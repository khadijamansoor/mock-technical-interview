import { pool } from "@/lib/db";
import { notFound } from "next/navigation";
import ChatInterface from "@/components/ChatInterface";

export default async function InterviewRoom({ params }: { params: Promise<{ id: string }> }) {
  const sessionId = (await params).id;
  const client = await pool.connect();
  let session = null;
  let turns = [];

  try {
    const sessionRes = await client.query("SELECT * FROM interview_sessions WHERE id = $1", [sessionId]);
    session = sessionRes.rows[0];

    if (!session) {
      return notFound();
    }

    const turnsRes = await client.query(
      "SELECT id, speaker, content, question_id, eval_json FROM turns WHERE session_id = $1 ORDER BY sequence_number ASC",
      [sessionId]
    );
    turns = turnsRes.rows;
  } finally {
    client.release();
  }

  // Find the most recent question id
  const lastQuestionTurn = [...turns].reverse().find(t => t.speaker === 'interviewer' && t.question_id);
  const currentQuestionId = lastQuestionTurn?.question_id || null;

  return (
    <main className="min-h-screen bg-gray-950 text-gray-100 flex flex-col h-screen">
      <header className="bg-gray-900 border-b border-gray-800 p-4 shadow-md flex justify-between items-center z-10">
        <div>
          <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-500">
            Interview with Jasmine
          </h1>
          <p className="text-xs text-gray-400">Role: {session.role_track}</p>
        </div>
        <div>
          <div className="flex items-center space-x-2">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
            </span>
            <span className="text-sm text-gray-300">Live</span>
          </div>
        </div>
      </header>
      
      <div className="flex-1 overflow-hidden relative">
        <ChatInterface 
          sessionId={sessionId} 
          initialTurns={turns} 
          initialQuestionId={currentQuestionId}
          status={session.status}
          candidateName={session.candidate_name || null}
        />
      </div>
    </main>
  );
}
