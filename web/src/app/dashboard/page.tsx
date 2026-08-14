import { pool } from "@/lib/db";
import Link from "next/link";
import { Play } from "lucide-react";
import { createClient } from "@/lib/supabase-server";
import { getOrCreateAppUser } from "@/lib/get-or-create-app-user";
import { redirect } from "next/navigation";

export default async function DashboardHomePage() {
  const supabase = await createClient();
  const { data: { user: supabaseUser } } = await supabase.auth.getUser();

  if (!supabaseUser) {
    redirect("/login");
  }

  const userId = await getOrCreateAppUser(supabaseUser);

  const client = await pool.connect();
  let user: any = null;
  let activeResume: any = null;
  let activeJd: any = null;
  
  let completedCount = 0;
  let lastSessionDate: Date | null = null;
  let last5Completed: any[] = [];
  let recentSessions: any[] = [];

  try {
    // Fetch the app user
    const userRes = await client.query("SELECT * FROM users WHERE id = $1", [userId]);
    user = userRes.rows[0];

    if (user) {
      // Fetch active resume
      if (user.active_resume_id) {
        const resumeRes = await client.query("SELECT * FROM resumes WHERE id = $1", [user.active_resume_id]);
        activeResume = resumeRes.rows[0];
      }
      
      // Fetch active JD
      if (user.active_jd_id) {
        const jdRes = await client.query("SELECT * FROM job_descriptions WHERE id = $1", [user.active_jd_id]);
        activeJd = jdRes.rows[0];
      }

      // Stats
      const countRes = await client.query("SELECT COUNT(*) FROM interview_sessions WHERE user_id = $1 AND status = 'completed'", [user.id]);
      completedCount = parseInt(countRes.rows[0].count, 10);

      const maxRes = await client.query("SELECT MAX(ended_at) as last_session FROM interview_sessions WHERE user_id = $1 AND status = 'completed'", [user.id]);
      lastSessionDate = maxRes.rows[0].last_session;

      // Radar (last 5 completed)
      const radarRes = await client.query(`
        SELECT s.id, s.ended_at, sc.rubric_scores
        FROM interview_sessions s
        JOIN scorecards sc ON s.id = sc.session_id
        WHERE s.user_id = $1 AND s.status = 'completed'
        ORDER BY s.ended_at DESC
        LIMIT 5
      `, [user.id]);
      last5Completed = radarRes.rows;

      // Recent (last 5 all)
      const recentRes = await client.query(`
        SELECT s.id, s.started_at, s.role_track, jd.title as jd_title, sc.rubric_scores
        FROM interview_sessions s
        LEFT JOIN job_descriptions jd ON s.job_description_id = jd.id
        LEFT JOIN scorecards sc ON s.id = sc.session_id
        WHERE s.user_id = $1
        ORDER BY s.started_at DESC
        LIMIT 5
      `, [user.id]);
      recentSessions = recentRes.rows;
    }
  } finally {
    client.release();
  }

  const firstName = user?.email?.split('@')[0] || "there";
  const hasActiveContext = !!activeResume;

  // Radar calculations
  const scores = { correctness: 0, depth: 0, communication: 0, problem_solving: 0 };
  let hasRadarData = last5Completed.length > 0;
  let focusArea = "—";
  let lowestAxis = "";

  if (hasRadarData) {
    last5Completed.forEach(s => {
      scores.correctness += s.rubric_scores.correctness || 0;
      scores.depth += s.rubric_scores.depth || 0;
      scores.communication += s.rubric_scores.communication || 0;
      scores.problem_solving += s.rubric_scores.problem_solving || 0;
    });
    scores.correctness /= last5Completed.length;
    scores.depth /= last5Completed.length;
    scores.communication /= last5Completed.length;
    scores.problem_solving /= last5Completed.length;

    // find lowest
    let min = Infinity;
    Object.entries(scores).forEach(([key, val]) => {
      if (val < min) {
        min = val;
        lowestAxis = key;
      }
    });

    const axisNames: Record<string, string> = {
      correctness: "Correctness",
      depth: "Depth",
      communication: "Communication",
      problem_solving: "Problem Solving"
    };
    focusArea = axisNames[lowestAxis] || "—";
  }

  // Days since last session
  let daysSince = "—";
  if (lastSessionDate) {
    const diffTime = Math.abs(new Date().getTime() - new Date(lastSessionDate).getTime());
    daysSince = Math.floor(diffTime / (1000 * 60 * 60 * 24)).toString();
  }

  // Helper for radar SVG
  // This is a simple generic polygon projection for a 4-axis radar chart.
  // Values 1-5 mapped to 20-100 radius (center is 50,50). 1 => 20% from center, 5 => 100%.
  // Center is 50, max is 50 radius.
  // Axis 0 (top): x=50, y=50 - r
  // Axis 1 (right): x=50 + r, y=50
  // Axis 2 (bottom): x=50, y=50 + r
  // Axis 3 (left): x=50 - r, y=50
  const getRadius = (val: number) => {
    // scale 1-5 to 0-4, then 0-4 to 10-50 radius
    return 10 + ((val - 1) / 4) * 40; 
  };

  const radarPoints = hasRadarData ? [
    `50,${50 - getRadius(scores.correctness)}`,
    `${50 + getRadius(scores.depth)},50`,
    `50,${50 + getRadius(scores.problem_solving)}`,
    `${50 - getRadius(scores.communication)},50`
  ].join(" ") : "50,50 50,50 50,50 50,50";

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-8">
      <header className="mb-8">
        <h1 className="text-3xl font-heading font-bold text-text-primary">
          Welcome back, {firstName}
        </h1>
        <p className="text-text-muted mt-2 font-sans">Here's your interview readiness overview.</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Stats & Recent */}
        <div className="lg:col-span-2 space-y-6">
          {/* Stat Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-surface border border-surface-hover p-5 rounded-xl">
              <h3 className="text-sm font-medium text-text-muted font-sans mb-1">Sessions Completed</h3>
              <p className="text-2xl font-bold text-text-primary font-mono">{completedCount}</p>
            </div>
            <div className="bg-surface border border-surface-hover p-5 rounded-xl">
              <h3 className="text-sm font-medium text-text-muted font-sans mb-1">Current Focus Area</h3>
              <p className={`text-xl font-bold font-mono ${hasRadarData ? 'text-accent-alert' : 'text-text-primary'}`}>{focusArea}</p>
            </div>
            <div className="bg-surface border border-surface-hover p-5 rounded-xl">
              <h3 className="text-sm font-medium text-text-muted font-sans mb-1">Days Since Last Session</h3>
              <p className="text-2xl font-bold text-text-primary font-mono">{daysSince}</p>
            </div>
          </div>

          {/* Readiness Radar */}
          <div className="bg-surface border border-surface-hover rounded-xl p-6 flex flex-col relative overflow-hidden">
            <h2 className="text-lg font-heading font-semibold text-text-primary mb-4">Readiness Radar</h2>
            
            <div className="flex-1 flex flex-col items-center justify-center text-center px-4 relative z-10 py-4">
              {!hasRadarData ? (
                <>
                  <svg className="w-32 h-32 text-surface-hover mb-4" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <polygon points="50,10 90,50 50,90 10,50" stroke="currentColor" strokeWidth="2" strokeDasharray="4 4"/>
                    <line x1="50" y1="10" x2="50" y2="90" stroke="currentColor" strokeWidth="1" strokeDasharray="2 2" />
                    <line x1="10" y1="50" x2="90" y2="50" stroke="currentColor" strokeWidth="1" strokeDasharray="2 2" />
                    <circle cx="50" cy="50" r="3" fill="currentColor"/>
                  </svg>
                  <p className="text-text-muted font-sans max-w-sm">
                    Complete your first interview to see your Readiness Radar across Correctness, Depth, Communication, and Problem-solving.
                  </p>
                </>
              ) : (
                <div className="flex w-full items-center justify-center gap-8">
                  {/* Radar Chart */}
                  <div className="relative w-48 h-48">
                    <svg viewBox="0 0 100 100" className="w-full h-full overflow-visible">
                      {/* Background Web */}
                      {[1, 2, 3, 4, 5].map(level => {
                        const r = getRadius(level);
                        return (
                          <polygon 
                            key={level} 
                            points={`50,${50-r} ${50+r},50 50,${50+r} ${50-r},50`} 
                            fill="none" 
                            stroke="var(--surface-hover)" 
                            strokeWidth="1"
                          />
                        );
                      })}
                      {/* Axes Lines */}
                      <line x1="50" y1="0" x2="50" y2="100" stroke="var(--surface-hover)" strokeWidth="1" />
                      <line x1="0" y1="50" x2="100" y2="50" stroke="var(--surface-hover)" strokeWidth="1" />
                      
                      {/* Data Polygon */}
                      <polygon 
                        points={radarPoints}
                        fill="var(--accent-secondary)"
                        fillOpacity="0.2"
                        stroke="var(--accent-secondary)"
                        strokeWidth="2"
                      />
                      
                      {/* Alert Axis for Focus Area */}
                      {lowestAxis === 'correctness' && <line x1="50" y1="50" x2="50" y2="0" stroke="var(--accent-alert)" strokeWidth="2" strokeDasharray="4 2"/>}
                      {lowestAxis === 'depth' && <line x1="50" y1="50" x2="100" y2="50" stroke="var(--accent-alert)" strokeWidth="2" strokeDasharray="4 2"/>}
                      {lowestAxis === 'problem_solving' && <line x1="50" y1="50" x2="50" y2="100" stroke="var(--accent-alert)" strokeWidth="2" strokeDasharray="4 2"/>}
                      {lowestAxis === 'communication' && <line x1="50" y1="50" x2="0" y2="50" stroke="var(--accent-alert)" strokeWidth="2" strokeDasharray="4 2"/>}

                      {/* Labels */}
                      <text x="50" y="-10" textAnchor="middle" className={`text-[10px] font-sans ${lowestAxis === 'correctness' ? 'fill-accent-alert font-bold' : 'fill-text-muted'}`}>Correctness</text>
                      <text x="110" y="53" textAnchor="start" className={`text-[10px] font-sans ${lowestAxis === 'depth' ? 'fill-accent-alert font-bold' : 'fill-text-muted'}`}>Depth</text>
                      <text x="50" y="115" textAnchor="middle" className={`text-[10px] font-sans ${lowestAxis === 'problem_solving' ? 'fill-accent-alert font-bold' : 'fill-text-muted'}`}>Problem Solving</text>
                      <text x="-10" y="53" textAnchor="end" className={`text-[10px] font-sans ${lowestAxis === 'communication' ? 'fill-accent-alert font-bold' : 'fill-text-muted'}`}>Communication</text>
                    </svg>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Recent Sessions */}
          <div className="bg-surface border border-surface-hover rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-heading font-semibold text-text-primary">Recent Sessions</h2>
              <Link href="/dashboard/history" className="text-sm text-accent-secondary hover:underline font-sans">
                View all
              </Link>
            </div>
            
            {recentSessions.length === 0 ? (
              <div className="py-8 text-center border-2 border-dashed border-surface-hover rounded-lg">
                <p className="text-text-muted font-sans">No interviews yet</p>
              </div>
            ) : (
              <div className="space-y-3">
                {recentSessions.map(session => {
                  let overallScore = "—";
                  if (session.rubric_scores) {
                    const avg = (
                      (session.rubric_scores.correctness || 0) + 
                      (session.rubric_scores.depth || 0) + 
                      (session.rubric_scores.communication || 0) + 
                      (session.rubric_scores.problem_solving || 0)
                    ) / 4;
                    overallScore = avg.toFixed(1);
                  }

                  return (
                    <div key={session.id} className="flex items-center justify-between p-4 bg-bg-base border border-surface-hover rounded-lg">
                      <div>
                        <p className="font-medium text-text-primary text-sm">{session.jd_title || session.role_track}</p>
                        <p className="text-xs text-text-muted mt-1 font-mono">{new Date(session.started_at).toLocaleDateString()}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold text-text-primary font-mono">{overallScore}</p>
                        {overallScore !== "—" && <p className="text-[10px] text-text-muted font-sans uppercase">Avg Score</p>}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Context & Action */}
        <div className="space-y-6">
          {/* Active Context Card */}
          <div className="bg-surface border border-surface-hover rounded-xl p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-heading font-semibold text-text-primary">Active Context</h2>
              <Link href="/dashboard/library" className="text-sm text-accent-secondary hover:underline font-sans">
                Change
              </Link>
            </div>

            <div className="space-y-4">
              {/* Resume */}
              <div>
                <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2 font-sans">Resume</h3>
                {activeResume ? (
                  <div className="p-3 bg-bg-base border border-surface-hover rounded-lg flex items-start gap-3">
                    <div className="bg-surface-hover p-2 rounded text-text-muted">📄</div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-text-primary truncate" title={activeResume.file_path.split('/').pop()}>
                        {activeResume.file_path.split('/').pop()?.replace(/^\d+-/, '')}
                      </p>
                      <p className="text-xs text-text-muted font-mono mt-0.5">
                        {new Date(activeResume.uploaded_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="p-3 bg-bg-base border border-dashed border-surface-hover rounded-lg text-sm text-text-muted text-center font-sans">
                    No active resume
                  </div>
                )}
              </div>

              {/* Job Description */}
              <div>
                <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2 font-sans">Job Description</h3>
                {activeJd ? (
                  <div className="p-3 bg-bg-base border border-surface-hover rounded-lg">
                    <p className="text-sm font-medium text-text-primary truncate" title={activeJd.title}>
                      {activeJd.title}
                    </p>
                    {activeJd.company && (
                      <p className="text-xs text-text-muted font-sans mt-0.5">{activeJd.company}</p>
                    )}
                    <p className="text-xs text-text-muted font-mono mt-2">
                      Added {new Date(activeJd.created_at).toLocaleDateString()}
                    </p>
                  </div>
                ) : (
                  <div className="p-3 bg-bg-base border border-dashed border-surface-hover rounded-lg text-sm text-text-muted text-center font-sans">
                    No active job description
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Start Interview Action */}
          <div className="bg-surface border border-surface-hover rounded-xl p-6 flex flex-col items-center text-center">
            <h2 className="text-lg font-heading font-semibold text-text-primary mb-2">Ready to practice?</h2>
            <p className="text-sm text-text-muted font-sans mb-6">
              Start a new mock interview session using your active context.
            </p>
            
            <div className="w-full relative group">
              <Link 
                href={hasActiveContext ? "/dashboard/start" : "#"}
                className={`w-full py-3 px-4 rounded-lg flex items-center justify-center gap-2 font-semibold font-sans transition-all
                  ${hasActiveContext 
                    ? "bg-accent-secondary text-surface hover:bg-opacity-90 shadow-[0_0_15px_rgba(79,209,197,0.3)]" 
                    : "bg-surface-hover text-text-muted cursor-not-allowed pointer-events-none"
                  }
                `}
              >
                <Play size={18} fill={hasActiveContext ? "currentColor" : "none"} />
                Start Interview
              </Link>
              
              {!hasActiveContext && (
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-2 bg-text-primary text-surface text-xs rounded shadow-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 font-sans">
                  Please set an active resume first.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
