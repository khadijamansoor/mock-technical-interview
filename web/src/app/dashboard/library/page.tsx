import { pool } from "@/lib/db";
import { 
  uploadResume, 
  deleteResume, 
  setActiveResume, 
  getSignedUrl,
  saveJobDescription,
  deleteJobDescription,
  setActiveJobDescription
} from "./actions";
import { redirect } from "next/navigation";

export default async function LibraryPage() {
  const client = await pool.connect();
  let user: any = null;
  let resumes: any[] = [];
  let jds: any[] = [];

  try {
    const userRes = await client.query("SELECT * FROM users LIMIT 1");
    user = userRes.rows[0];

    if (user) {
      const resumesRes = await client.query("SELECT * FROM resumes WHERE user_id = $1 ORDER BY uploaded_at DESC", [user.id]);
      resumes = resumesRes.rows;

      const jdsRes = await client.query("SELECT * FROM job_descriptions WHERE user_id = $1 ORDER BY created_at DESC", [user.id]);
      jds = jdsRes.rows;
    }
  } finally {
    client.release();
  }

  if (!user) {
    return <div className="p-8 text-white">No user found. Please start an interview first to initialize the user.</div>;
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white p-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold mb-8 text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-500">
          Library Context
        </h1>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          
          {/* Resumes Column */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 shadow-xl">
            <h2 className="text-xl font-semibold mb-6">Resumes</h2>
            
            <form action={uploadResume} className="mb-8">
              <label className="block mb-2 text-sm font-medium text-gray-300">Upload New Resume (PDF, DOCX)</label>
              <div className="flex gap-4">
                <input 
                  type="file" 
                  name="file" 
                  accept=".pdf,.docx" 
                  required 
                  className="block w-full text-sm text-gray-300
                    file:mr-4 file:py-2 file:px-4
                    file:rounded-md file:border-0
                    file:text-sm file:font-semibold
                    file:bg-blue-600 file:text-white
                    hover:file:bg-blue-700
                    cursor-pointer bg-gray-800 rounded-md border border-gray-700"
                />
                <button 
                  type="submit" 
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-md text-sm font-medium transition-colors"
                >
                  Upload
                </button>
              </div>
            </form>

            <div className="space-y-4">
              {resumes.length === 0 && <p className="text-gray-500 text-sm">No resumes uploaded yet.</p>}
              {resumes.map(resume => {
                const isActive = user.active_resume_id === resume.id;
                const fileName = resume.file_path.split('/').pop()?.replace(/^\d+-/, ''); // basic strip of timestamp
                
                return (
                  <div key={resume.id} className={`p-4 rounded-lg border ${isActive ? 'border-blue-500 bg-blue-900/20' : 'border-gray-700 bg-gray-800'}`}>
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <p className="font-medium text-gray-200">{fileName || 'Unknown File'}</p>
                        <p className="text-xs text-gray-500 mt-1">Uploaded {new Date(resume.uploaded_at).toLocaleDateString()}</p>
                      </div>
                      {isActive && <span className="px-2 py-1 bg-blue-600/30 text-blue-400 text-xs rounded border border-blue-500/30">Active</span>}
                    </div>
                    
                    <div className="flex gap-2 text-sm mt-4">
                      {!isActive && (
                        <form action={async () => { "use server"; await setActiveResume(resume.id); }}>
                          <button type="submit" className="text-blue-400 hover:text-blue-300 px-3 py-1.5 bg-gray-900 rounded border border-gray-700 hover:border-gray-600 transition-colors">
                            Set Active
                          </button>
                        </form>
                      )}
                      
                      <form action={async () => {
                        "use server";
                        const url = await getSignedUrl(resume.file_path);
                        if (url) redirect(url);
                      }}>
                        <button type="submit" className="text-gray-300 hover:text-white px-3 py-1.5 bg-gray-900 rounded border border-gray-700 hover:border-gray-600 transition-colors">
                          Download
                        </button>
                      </form>
                      
                      <form action={async () => { "use server"; await deleteResume(resume.id, resume.file_path); }}>
                        <button type="submit" className="text-red-400 hover:text-red-300 px-3 py-1.5 bg-gray-900 rounded border border-gray-700 hover:border-red-900/50 transition-colors">
                          Delete
                        </button>
                      </form>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Job Descriptions Column */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 shadow-xl">
            <h2 className="text-xl font-semibold mb-6">Job Descriptions</h2>
            
            <form action={saveJobDescription} className="mb-8 space-y-4">
              <div>
                <label className="block mb-1 text-sm font-medium text-gray-300">Job Title <span className="text-red-400">*</span></label>
                <input 
                  type="text" 
                  name="title" 
                  required 
                  className="w-full bg-gray-800 border border-gray-700 rounded-md px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
                  placeholder="e.g. Senior Frontend Engineer"
                />
              </div>
              <div>
                <label className="block mb-1 text-sm font-medium text-gray-300">Company (Optional)</label>
                <input 
                  type="text" 
                  name="company" 
                  className="w-full bg-gray-800 border border-gray-700 rounded-md px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
                  placeholder="e.g. Acme Corp"
                />
              </div>
              <div>
                <label className="block mb-1 text-sm font-medium text-gray-300">Description <span className="text-red-400">*</span></label>
                <textarea 
                  name="rawText" 
                  required 
                  rows={5}
                  className="w-full bg-gray-800 border border-gray-700 rounded-md px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500 resize-none"
                  placeholder="Paste the raw job description text here..."
                />
              </div>
              <button 
                type="submit" 
                className="w-full py-2 bg-purple-600 hover:bg-purple-700 rounded-md text-sm font-medium transition-colors"
              >
                Save Job Description
              </button>
            </form>

            <div className="space-y-4">
              {jds.length === 0 && <p className="text-gray-500 text-sm">No job descriptions saved yet.</p>}
              {jds.map(jd => {
                const isActive = user.active_jd_id === jd.id;
                
                return (
                  <div key={jd.id} className={`p-4 rounded-lg border ${isActive ? 'border-purple-500 bg-purple-900/20' : 'border-gray-700 bg-gray-800'}`}>
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <p className="font-medium text-gray-200">{jd.title}</p>
                        {jd.company && <p className="text-sm text-gray-400 mt-0.5">{jd.company}</p>}
                        <p className="text-xs text-gray-500 mt-2">Added {new Date(jd.created_at).toLocaleDateString()}</p>
                      </div>
                      {isActive && <span className="px-2 py-1 bg-purple-600/30 text-purple-400 text-xs rounded border border-purple-500/30">Active</span>}
                    </div>
                    
                    <div className="mt-3 text-sm text-gray-400 line-clamp-2 italic border-l-2 border-gray-700 pl-3">
                      "{jd.raw_text}"
                    </div>

                    <div className="flex gap-2 text-sm mt-4">
                      {!isActive && (
                        <form action={async () => { "use server"; await setActiveJobDescription(jd.id); }}>
                          <button type="submit" className="text-purple-400 hover:text-purple-300 px-3 py-1.5 bg-gray-900 rounded border border-gray-700 hover:border-gray-600 transition-colors">
                            Set Active
                          </button>
                        </form>
                      )}
                      
                      <form action={async () => { "use server"; await deleteJobDescription(jd.id); }}>
                        <button type="submit" className="text-red-400 hover:text-red-300 px-3 py-1.5 bg-gray-900 rounded border border-gray-700 hover:border-red-900/50 transition-colors">
                          Delete
                        </button>
                      </form>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
