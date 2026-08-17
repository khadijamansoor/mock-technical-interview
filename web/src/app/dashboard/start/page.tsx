import { createSession } from "./actions";
import { pool } from "@/lib/db";
import TrackSelectionForm from "@/components/TrackSelectionForm";
import { createClient } from "@/lib/supabase-server";
import { redirect } from "next/navigation";

export default async function StartInterviewPage() {
  const supabase = await createClient();
  const { data: { user: supabaseUser } } = await supabase.auth.getUser();

  if (!supabaseUser) {
    redirect("/login");
  }

  const client = await pool.connect();
  let availableCombinations: { role_track: string; round_type: string | null }[] = [];
  
  try {
    const res = await client.query("SELECT DISTINCT role_track, round_type FROM questions");
    availableCombinations = res.rows;
  } finally {
    client.release();
  }

  return (
    <main className="min-h-screen bg-gray-950 text-white flex items-center justify-center p-4 py-12">
      <div className="max-w-4xl w-full bg-gray-900 border border-gray-800 rounded-xl shadow-2xl p-8">
        <div className="mb-8 text-center relative">
          <a 
            href="/dashboard/library" 
            className="absolute top-0 right-0 text-sm text-blue-400 hover:text-blue-300 transition-colors bg-gray-800 px-3 py-1.5 rounded-md border border-gray-700 font-sans"
          >
            Change Resume/JD &rarr;
          </a>
          <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-500 font-heading">
            Mock Interview
          </h1>
          <p className="text-gray-400 mt-2 font-sans">AI-powered technical interviewing</p>
        </div>

        <form action={createSession} className="space-y-6 mt-8">
          <TrackSelectionForm availableCombinations={availableCombinations} />
        </form>
      </div>
    </main>
  );
}
