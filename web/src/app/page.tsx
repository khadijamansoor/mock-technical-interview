import { createSession } from "./actions";

export default function Home() {
  return (
    <main className="min-h-screen bg-gray-950 text-white flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-gray-900 border border-gray-800 rounded-xl shadow-2xl p-8">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-500">
            Mock Interview
          </h1>
          <p className="text-gray-400 mt-2">AI-powered technical interviewing</p>
        </div>

        <form action={createSession} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Role Track</label>
            <select 
              name="role" 
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="fullstack">Full Stack Engineering</option>
              <option value="frontend">Frontend Engineering</option>
              <option value="backend">Backend Engineering</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Focus Topic (Optional)</label>
            <input 
              type="text" 
              name="topic" 
              placeholder="e.g. React, System Design, Databases" 
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Difficulty</label>
            <select 
              name="difficulty" 
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="easy">Easy</option>
              <option value="medium">Medium</option>
              <option value="hard">Hard</option>
            </select>
          </div>

          <button 
            type="submit" 
            className="w-full bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-400 hover:to-purple-500 text-white font-bold py-3 px-4 rounded-lg shadow-lg transform transition-all active:scale-95"
          >
            Start Interview
          </button>
        </form>
      </div>
    </main>
  );
}
