import { pool } from "@/lib/db";
import { notFound } from "next/navigation";

const DIMENSION_LABELS: Record<string, { label: string; color: string }> = {
  correctness: { label: "Correctness", color: "from-blue-500 to-blue-600" },
  depth: { label: "Depth", color: "from-purple-500 to-purple-600" },
  communication: { label: "Communication", color: "from-emerald-500 to-emerald-600" },
  problem_solving: { label: "Problem Solving", color: "from-amber-500 to-amber-600" },
};

export default async function ScorecardPage({ params }: { params: Promise<{ id: string }> }) {
  const sessionId = (await params).id;
  const client = await pool.connect();

  let scorecard = null;
  let session = null;

  try {
    const sessionRes = await client.query(
      "SELECT role_track, candidate_name, started_at, ended_at FROM interview_sessions WHERE id = $1",
      [sessionId]
    );
    session = sessionRes.rows[0];
    if (!session) return notFound();

    const scorecardRes = await client.query(
      "SELECT rubric_scores, overall_feedback, generated_at FROM scorecards WHERE session_id = $1",
      [sessionId]
    );
    scorecard = scorecardRes.rows[0];
    if (!scorecard) return notFound();
  } finally {
    client.release();
  }

  const scores = scorecard.rubric_scores;
  const overallAvg = Object.values(scores).reduce((sum: number, v: any) => sum + Number(v), 0) / Object.keys(scores).length;

  return (
    <main className="min-h-screen bg-gray-950 text-gray-100 p-6">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="text-center mb-10">
          <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-500 mb-2">
            Interview Scorecard
          </h1>
          <p className="text-gray-400">
            {session.candidate_name ? `${session.candidate_name}'s ` : ""}
            {session.role_track} Interview
          </p>
          <p className="text-xs text-gray-500 mt-1">
            Interviewed by <span className="text-blue-400 font-medium">Jasmine</span> • {new Date(scorecard.generated_at).toLocaleDateString()}
          </p>
        </div>

        {/* Overall Score */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8 mb-8 text-center">
          <p className="text-sm text-gray-400 uppercase tracking-wider mb-2">Overall Score</p>
          <div className="text-6xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-500">
            {overallAvg.toFixed(1)}
          </div>
          <p className="text-gray-500 mt-1">out of 5.0</p>
        </div>

        {/* Dimension Scores */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-10">
          {Object.entries(DIMENSION_LABELS).map(([key, { label, color }]) => {
            const score = scores[key] || 0;
            return (
              <div key={key} className="bg-gray-900 border border-gray-800 rounded-xl p-5">
                <div className="flex justify-between items-center mb-3">
                  <span className="text-sm font-medium text-gray-300">{label}</span>
                  <span className="text-2xl font-bold text-white">{score}<span className="text-sm text-gray-500">/5</span></span>
                </div>
                <div className="w-full bg-gray-800 rounded-full h-2.5">
                  <div
                    className={`bg-gradient-to-r ${color} h-2.5 rounded-full transition-all duration-1000`}
                    style={{ width: `${(score / 5) * 100}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>

        {/* Feedback */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8 mb-8">
          <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <span className="text-blue-400">Jasmine&apos;s</span> Feedback
          </h2>
          <div className="text-gray-300 leading-relaxed whitespace-pre-wrap">
            {scorecard.overall_feedback}
          </div>
        </div>

        {/* Back Link */}
        <div className="text-center">
          <a
            href="/"
            className="inline-block bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-400 hover:to-purple-500 text-white font-bold py-3 px-8 rounded-xl shadow-lg transform transition-all active:scale-95"
          >
            Start New Interview
          </a>
        </div>
      </div>
    </main>
  );
}
