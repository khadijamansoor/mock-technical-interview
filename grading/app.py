import os
import json
import time
from flask import Flask, request, jsonify
import psycopg
from dotenv import load_dotenv
from sentence_transformers import SentenceTransformer
from groq import Groq
import warnings

warnings.filterwarnings("ignore", category=UserWarning, module="huggingface_hub.*")
# Load .env from the root directory
load_dotenv(os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), '.env'))
DATABASE_URL = os.getenv("DATABASE_URL")
GROQ_API_KEY = os.getenv("GROQ_API_KEY")

app = Flask(__name__)

print("Loading local embedding model (all-MiniLM-L6-v2)...")
# Note: we use all-MiniLM-L6-v2 since our db is vector(384)
model = SentenceTransformer('all-MiniLM-L6-v2')
print("Model loaded successfully.")

# Initialize Groq client
client = Groq(api_key=GROQ_API_KEY) if GROQ_API_KEY else None

@app.get("/health")
def health():
    return {"status": "ok", "model_loaded": model is not None}

@app.post("/next-question")
def next_question():
    """
    Accepts:
    {
      "target_gap": "optional area to dig into",
      "role_track": "frontend",
      "difficulty": "medium",
      "asked_question_ids": ["uuid1", "uuid2"]
    }
    """
    data = request.json
    target_gap = data.get("target_gap", "")
    role_track = data.get("role_track", "frontend")
    difficulty = data.get("difficulty", "medium")
    asked_question_ids = data.get("asked_question_ids", [])
    
    # If no specific gap is identified, fall back to a generic query string
    search_text = target_gap if target_gap else f"{role_track} {difficulty} interview question"
    
    start_time = time.time()
    embedding = model.encode(search_text).tolist()
    
    with psycopg.connect(DATABASE_URL) as conn:
        with conn.cursor() as cur:
            # We want to find a question that matches role, difficulty, and hasn't been asked, ordered by cosine distance
            query = """
                SELECT id, text, role_track, topic, difficulty, ideal_answer_points
                FROM questions
                WHERE role_track = %s AND difficulty = %s AND id != ALL(%s)
                ORDER BY embedding <=> %s::vector
                LIMIT 1;
            """
            cur.execute(query, (role_track, difficulty, asked_question_ids, embedding))
            row = cur.fetchone()
            
    elapsed_time = time.time() - start_time
    print(f"Vector search took {elapsed_time:.3f}s")
    
    if not row:
        return jsonify({"error": "No more questions available"}), 404
        
    return jsonify({
        "id": row[0],
        "text": row[1],
        "role_track": row[2],
        "topic": row[3],
        "difficulty": row[4],
        "ideal_answer_points": row[5],
        "latency_sec": elapsed_time
    })

@app.post("/grade")
def grade():
    """
    Holistic transcript grading.
    Accepts:
    {
       "session_id": "uuid"
    }
    """
    if not client:
        return jsonify({"error": "GROQ_API_KEY not set"}), 500
        
    data = request.json
    session_id = data.get("session_id")
    
    with psycopg.connect(DATABASE_URL) as conn:
        with conn.cursor() as cur:
            # Fetch the entire transcript for this session
            cur.execute("""
                SELECT speaker, content 
                FROM turns 
                WHERE session_id = %s 
                ORDER BY sequence_number ASC
            """, (session_id,))
            rows = cur.fetchall()
            
            if not rows:
                return jsonify({"error": "No transcript found for session"}), 404
            
            transcript = "\n\n".join([f"{r[0].upper()}:\n{r[1]}" for r in rows])
            
            prompt = f"""You are an expert technical interviewer evaluating a candidate's full interview performance.
Review the transcript below and provide a final holistic grade across 4 dimensions: correctness, depth, communication, problem_solving.
Score each dimension from 1 to 5. Also provide overall_feedback (a few paragraphs of constructive feedback identifying overarching patterns).

Output strictly in JSON format matching this schema:
{{
  "rubric_scores": {{
    "correctness": <int 1-5>,
    "depth": <int 1-5>,
    "communication": <int 1-5>,
    "problem_solving": <int 1-5>
  }},
  "overall_feedback": "<string>"
}}

TRANSCRIPT:
{transcript}
"""
            completion = client.chat.completions.create(
                model="llama-3.1-8b-instant", # fast and cheap model for JSON output
                messages=[{"role": "user", "content": prompt}],
                temperature=0.2,
                response_format={"type": "json_object"}
            )
            
            result_json = completion.choices[0].message.content
            result = json.loads(result_json)
            
            # Insert scorecard
            cur.execute("""
                INSERT INTO scorecards (session_id, rubric_scores, overall_feedback)
                VALUES (%s, %s, %s)
                RETURNING id
            """, (session_id, json.dumps(result["rubric_scores"]), result["overall_feedback"]))
            
            scorecard_id = cur.fetchone()[0]
            
            return jsonify({
                "scorecard_id": scorecard_id,
                "rubric_scores": result["rubric_scores"],
                "overall_feedback": result["overall_feedback"]
            })

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True, use_reloader=False)
