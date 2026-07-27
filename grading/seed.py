import os
import json
import psycopg
from pgvector.psycopg import register_vector
from sentence_transformers import SentenceTransformer
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), '.env'))

DATABASE_URL = os.getenv("DATABASE_URL")

print("Loading local embedding model (all-MiniLM-L6-v2)...")
model = SentenceTransformer('all-MiniLM-L6-v2')

# 30 Questions across different tracks and difficulties
questions = [
    # Frontend
    {"text": "Explain the virtual DOM in React.", "role_track": "frontend", "topic": "react", "difficulty": "easy", "ideal_answer_points": ["In-memory representation of real DOM", "Enables efficient diffing algorithm", "Only updates changed nodes"]},
    {"text": "How does CSS Flexbox differ from CSS Grid?", "role_track": "frontend", "topic": "css", "difficulty": "medium", "ideal_answer_points": ["Flexbox is one-dimensional", "Grid is two-dimensional", "Flexbox is content-first, Grid is layout-first"]},
    {"text": "What are React Server Components?", "role_track": "frontend", "topic": "react", "difficulty": "hard", "ideal_answer_points": ["Execute exclusively on the server", "Zero bundle size effect", "Direct access to backend resources"]},
    {"text": "Explain Event Delegation in JavaScript.", "role_track": "frontend", "topic": "javascript", "difficulty": "medium", "ideal_answer_points": ["Attaching single event listener to parent", "Relies on event bubbling", "Improves memory and performance"]},
    {"text": "How do you optimize a frontend application for Core Web Vitals?", "role_track": "frontend", "topic": "performance", "difficulty": "hard", "ideal_answer_points": ["Optimize LCP via image preloading/CDN", "Reduce CLS by setting image dimensions", "Improve INP by breaking up long tasks"]},
    {"text": "What is closure in JavaScript?", "role_track": "frontend", "topic": "javascript", "difficulty": "easy", "ideal_answer_points": ["Function bundled with lexical environment", "Access to outer scope variables", "Maintained even after outer function returns"]},
    {"text": "Describe the Box Model in CSS.", "role_track": "frontend", "topic": "css", "difficulty": "easy", "ideal_answer_points": ["Content, padding, border, margin", "Affects element sizing", "box-sizing: border-box changes calculation"]},
    {"text": "How does CORS work?", "role_track": "frontend", "topic": "security", "difficulty": "medium", "ideal_answer_points": ["Cross-Origin Resource Sharing", "Uses HTTP headers", "Preflight OPTIONS request for complex requests"]},
    {"text": "Explain the difference between local storage, session storage, and cookies.", "role_track": "frontend", "topic": "web_storage", "difficulty": "medium", "ideal_answer_points": ["Local storage persists until deleted", "Session storage clears on tab close", "Cookies are sent with HTTP requests"]},
    {"text": "What is hydration in SSR frameworks like Next.js?", "role_track": "frontend", "topic": "react", "difficulty": "hard", "ideal_answer_points": ["Attaching event listeners to static HTML", "Making server-rendered page interactive", "Mismatch errors if client/server render differs"]},

    # Backend
    {"text": "What is the N+1 query problem and how do you solve it?", "role_track": "backend", "topic": "databases", "difficulty": "medium", "ideal_answer_points": ["Querying related data in a loop", "Causes multiple DB roundtrips", "Solved using eager loading or JOINs"]},
    {"text": "Explain the CAP theorem.", "role_track": "backend", "topic": "system_design", "difficulty": "hard", "ideal_answer_points": ["Consistency, Availability, Partition Tolerance", "Can only guarantee 2 out of 3", "In presence of partition, choose C or A"]},
    {"text": "What is the difference between SQL and NoSQL?", "role_track": "backend", "topic": "databases", "difficulty": "easy", "ideal_answer_points": ["SQL is relational and structured", "NoSQL is schema-less/flexible", "SQL scales vertically, NoSQL horizontally"]},
    {"text": "How do you implement rate limiting?", "role_track": "backend", "topic": "system_design", "difficulty": "medium", "ideal_answer_points": ["Token bucket or leaky bucket algorithm", "Redis or Memcached for tracking", "Returns 429 Too Many Requests"]},
    {"text": "Explain the differences between processes and threads.", "role_track": "backend", "topic": "operating_systems", "difficulty": "medium", "ideal_answer_points": ["Processes have independent memory", "Threads share memory within process", "Context switching is faster for threads"]},
    {"text": "What are database indexes and how do they work?", "role_track": "backend", "topic": "databases", "difficulty": "medium", "ideal_answer_points": ["Data structure improving read speed", "B-Tree or Hash implementations", "Slows down write operations"]},
    {"text": "Describe REST API architectural constraints.", "role_track": "backend", "topic": "api_design", "difficulty": "medium", "ideal_answer_points": ["Client-server, stateless", "Cacheable", "Uniform interface (HTTP verbs)"]},
    {"text": "How does a load balancer work?", "role_track": "backend", "topic": "system_design", "difficulty": "easy", "ideal_answer_points": ["Distributes traffic across servers", "Prevents single point of failure", "Algorithms like round-robin or least-connections"]},
    {"text": "Explain message queues and their use cases.", "role_track": "backend", "topic": "system_design", "difficulty": "medium", "ideal_answer_points": ["Asynchronous communication", "Decouples microservices", "Examples: RabbitMQ, Kafka"]},
    {"text": "How do you ensure idempotency in a distributed system?", "role_track": "backend", "topic": "system_design", "difficulty": "hard", "ideal_answer_points": ["Multiple identical requests yield same result", "Use unique idempotency keys", "Store key in DB to prevent duplicates"]},

    # Fullstack / General
    {"text": "What is a JWT and how does it work?", "role_track": "fullstack", "topic": "security", "difficulty": "medium", "ideal_answer_points": ["JSON Web Token for stateless auth", "Header, Payload, Signature", "Signature verifies integrity"]},
    {"text": "Explain the difference between monolithic and microservice architecture.", "role_track": "fullstack", "topic": "architecture", "difficulty": "medium", "ideal_answer_points": ["Monolith is single codebase/deployment", "Microservices are independent services", "Trade-offs in complexity vs scalability"]},
    {"text": "How do you mitigate XSS and CSRF attacks?", "role_track": "fullstack", "topic": "security", "difficulty": "hard", "ideal_answer_points": ["XSS: Sanitize inputs, encode outputs", "XSS: Use CSP (Content Security Policy)", "CSRF: Use anti-CSRF tokens or SameSite cookies"]},
    {"text": "What is Docker and why use it?", "role_track": "fullstack", "topic": "devops", "difficulty": "easy", "ideal_answer_points": ["Containerization platform", "Consistent environments across stages", "Isolates dependencies"]},
    {"text": "Describe the CI/CD pipeline.", "role_track": "fullstack", "topic": "devops", "difficulty": "medium", "ideal_answer_points": ["Continuous Integration (automated testing)", "Continuous Deployment (automated release)", "Reduces manual errors and speeds delivery"]},
    {"text": "What are webhooks?", "role_track": "fullstack", "topic": "api_design", "difficulty": "easy", "ideal_answer_points": ["User-defined HTTP callbacks", "Triggered by specific events", "Real-time server-to-server communication"]},
    {"text": "Explain the role of a reverse proxy.", "role_track": "fullstack", "topic": "system_design", "difficulty": "medium", "ideal_answer_points": ["Sits in front of backend servers", "Handles SSL termination", "Provides load balancing and caching"]},
    {"text": "How does Garbage Collection work in modern languages?", "role_track": "fullstack", "topic": "computer_science", "difficulty": "hard", "ideal_answer_points": ["Automatic memory management", "Mark-and-sweep algorithm", "Identifies unreachable objects"]},
    {"text": "What is WebSocket and when should you use it?", "role_track": "fullstack", "topic": "networking", "difficulty": "medium", "ideal_answer_points": ["Full-duplex bidirectional communication", "Persistent connection", "Used for chat apps, live feeds"]},
    {"text": "Explain Git rebase vs merge.", "role_track": "fullstack", "topic": "version_control", "difficulty": "medium", "ideal_answer_points": ["Merge creates a new merge commit", "Rebase rewrites commit history", "Rebase keeps history linear"]}
]

def main():
    print("Fixing the database schema (changing vector(1536) to 384 dimensions)...")
    with psycopg.connect(DATABASE_URL) as conn:
        with conn.cursor() as cur:
            try:
                cur.execute("DROP INDEX IF EXISTS idx_questions_embedding_cosine;")
                cur.execute("ALTER TABLE questions ALTER COLUMN embedding TYPE vector(384);")
                cur.execute("CREATE INDEX idx_questions_embedding_cosine ON questions USING ivfflat (embedding vector_cosine_ops) WITH (lists = 10);")
                conn.commit()
                print("Database schema successfully updated to 384 dimensions.")
            except Exception as e:
                print("Database schema update message:", e)
                conn.rollback()

    print("Connecting to database for insertion...")
    with psycopg.connect(DATABASE_URL) as conn:
        register_vector(conn)
        with conn.cursor() as cur:
            for q in questions:
                print(f"Generating embedding for: {q['text'][:30]}...")
                embedding = model.encode(q["text"]).tolist()
                
                cur.execute(
                    """
                    INSERT INTO questions (text, role_track, topic, difficulty, ideal_answer_points, embedding)
                    VALUES (%s, %s, %s, %s, %s, %s)
                    """,
                    (
                        q["text"],
                        q["role_track"],
                        q["topic"],
                        q["difficulty"],
                        json.dumps(q["ideal_answer_points"]),
                        embedding
                    )
                )
        conn.commit()
    print(f"\\nSuccessfully seeded {len(questions)} questions into the database!")

if __name__ == "__main__":
    main()
