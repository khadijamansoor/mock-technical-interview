import { pool } from "@/lib/db";
import Link from "next/link";
import { Play } from "lucide-react";

export default async function DashboardHomePage() {
  const client = await pool.connect();
  let user: any = null;
  let activeResume: any = null;
  let activeJd: any = null;

  try {
    // Fetch dummy user
    const userRes = await client.query("SELECT * FROM users LIMIT 1");
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
    }
  } finally {
    client.release();
  }

  const firstName = user?.email?.split('@')[0] || "there";
  const hasActiveContext = activeResume && activeJd;

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
              <p className="text-2xl font-bold text-text-primary font-mono">—</p>
            </div>
            <div className="bg-surface border border-surface-hover p-5 rounded-xl">
              <h3 className="text-sm font-medium text-text-muted font-sans mb-1">Current Focus Area</h3>
              <p className="text-2xl font-bold text-text-primary font-mono">—</p>
            </div>
            <div className="bg-surface border border-surface-hover p-5 rounded-xl">
              <h3 className="text-sm font-medium text-text-muted font-sans mb-1">Days Since Last Session</h3>
              <p className="text-2xl font-bold text-text-primary font-mono">—</p>
            </div>
          </div>

          {/* Readiness Radar Stub */}
          <div className="bg-surface border border-surface-hover rounded-xl p-6 h-80 flex flex-col relative overflow-hidden">
            <h2 className="text-lg font-heading font-semibold text-text-primary mb-4">Readiness Radar</h2>
            
            <div className="flex-1 flex flex-col items-center justify-center text-center px-4 relative z-10">
              <svg className="w-24 h-24 text-surface-hover mb-4" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
                <polygon points="50,10 90,50 50,90 10,50" stroke="currentColor" strokeWidth="2" strokeDasharray="4 4"/>
                <line x1="50" y1="10" x2="50" y2="90" stroke="currentColor" strokeWidth="1" strokeDasharray="2 2" />
                <line x1="10" y1="50" x2="90" y2="50" stroke="currentColor" strokeWidth="1" strokeDasharray="2 2" />
                <circle cx="50" cy="50" r="3" fill="currentColor"/>
              </svg>
              <p className="text-text-muted font-sans max-w-sm">
                Complete your first interview to see your Readiness Radar across Correctness, Depth, Communication, and Problem-solving.
              </p>
            </div>
          </div>

          {/* Recent Sessions Stub */}
          <div className="bg-surface border border-surface-hover rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-heading font-semibold text-text-primary">Recent Sessions</h2>
              <Link href="/dashboard/history" className="text-sm text-accent-secondary hover:underline font-sans">
                View all
              </Link>
            </div>
            <div className="py-8 text-center border-2 border-dashed border-surface-hover rounded-lg">
              <p className="text-text-muted font-sans">No interviews yet</p>
            </div>
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
              <form action={hasActiveContext ? "/interview/new" : "#"}>
                <button 
                  disabled={!hasActiveContext}
                  className={`w-full py-3 px-4 rounded-lg flex items-center justify-center gap-2 font-semibold font-sans transition-all
                    ${hasActiveContext 
                      ? "bg-accent-secondary text-surface hover:bg-opacity-90 shadow-[0_0_15px_rgba(79,209,197,0.3)]" 
                      : "bg-surface-hover text-text-muted cursor-not-allowed"
                    }
                  `}
                >
                  <Play size={18} fill={hasActiveContext ? "currentColor" : "none"} />
                  Start Interview
                </button>
              </form>
              
              {!hasActiveContext && (
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-2 bg-text-primary text-surface text-xs rounded shadow-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 font-sans">
                  Please set an active resume and job description first.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
