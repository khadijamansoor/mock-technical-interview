"""
Seed script: populate the `questions` table with starter interview questions
and compute their vector embeddings using all-MiniLM-L6-v2.
"""
import os
import sys
import json
import psycopg
from sentence_transformers import SentenceTransformer
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), '.env'))
DATABASE_URL = os.getenv("DATABASE_URL")

if not DATABASE_URL:
    print("ERROR: DATABASE_URL not found in .env")
    sys.exit(1)

model = SentenceTransformer('all-MiniLM-L6-v2')

QUESTIONS = [
    # --- Software Engineering: Easy ---
    {
        "text": "What is the difference between a stack and a queue? Can you describe a real-world use case for each?",
        "role_track": "software_engineering",
        "topic": "data_structures",
        "difficulty": "easy",
        "ideal_answer_points": ["LIFO vs FIFO", "Stack: undo/redo, call stack", "Queue: task scheduling, BFS"]
    },
    {
        "text": "Explain what a RESTful API is. What are the main HTTP methods and when would you use each one?",
        "role_track": "software_engineering",
        "topic": "web_fundamentals",
        "difficulty": "easy",
        "ideal_answer_points": ["REST = Representational State Transfer", "GET/POST/PUT/PATCH/DELETE", "Stateless", "Resource-based URLs"]
    },
    {
        "text": "What is the difference between an array and a linked list? When would you choose one over the other?",
        "role_track": "software_engineering",
        "topic": "data_structures",
        "difficulty": "easy",
        "ideal_answer_points": ["Contiguous vs node-based memory", "O(1) random access for arrays", "O(1) insert/delete for linked lists", "Cache locality"]
    },
    {
        "text": "What is version control, and why is Git the most popular system? Explain the basic Git workflow.",
        "role_track": "software_engineering",
        "topic": "tooling",
        "difficulty": "easy",
        "ideal_answer_points": ["Track changes over time", "Branching and merging", "clone/add/commit/push/pull", "Collaboration"]
    },

    # --- Software Engineering: Medium ---
    {
        "text": "Explain the concept of time complexity. Walk me through analyzing the time complexity of a nested loop.",
        "role_track": "software_engineering",
        "topic": "algorithms",
        "difficulty": "medium",
        "ideal_answer_points": ["Big-O notation", "Worst/average/best case", "Nested loop = O(n^2)", "Drop constants and lower-order terms"]
    },
    {
        "text": "What are the SOLID principles in object-oriented design? Pick two and explain how they improve code quality.",
        "role_track": "software_engineering",
        "topic": "design_patterns",
        "difficulty": "medium",
        "ideal_answer_points": ["Single Responsibility", "Open/Closed", "Liskov Substitution", "Interface Segregation", "Dependency Inversion", "Concrete examples"]
    },
    {
        "text": "Explain the difference between SQL and NoSQL databases. When would you choose one over the other for a new project?",
        "role_track": "software_engineering",
        "topic": "databases",
        "difficulty": "medium",
        "ideal_answer_points": ["Structured vs flexible schema", "ACID vs eventual consistency", "Joins vs denormalization", "Scale patterns"]
    },
    {
        "text": "What is a hash table and how does it work internally? What happens when two keys hash to the same bucket?",
        "role_track": "software_engineering",
        "topic": "data_structures",
        "difficulty": "medium",
        "ideal_answer_points": ["Hash function maps key to index", "O(1) average lookup", "Collision resolution: chaining or open addressing", "Load factor and resizing"]
    },
    {
        "text": "Describe the difference between processes and threads. What is a race condition and how do you prevent it?",
        "role_track": "software_engineering",
        "topic": "operating_systems",
        "difficulty": "medium",
        "ideal_answer_points": ["Process = isolated memory space", "Thread = shared memory within process", "Race condition = concurrent access to shared state", "Mutex/semaphore/lock"]
    },
    {
        "text": "What is the difference between authentication and authorization? Describe how JWT tokens work.",
        "role_track": "software_engineering",
        "topic": "security",
        "difficulty": "medium",
        "ideal_answer_points": ["AuthN = who you are", "AuthZ = what you can do", "JWT = header.payload.signature", "Stateless, base64 encoded, signed"]
    },

    # --- Software Engineering: Hard ---
    {
        "text": "Design a URL shortener like bit.ly. Walk me through the system design including storage, encoding, and scaling considerations.",
        "role_track": "software_engineering",
        "topic": "system_design",
        "difficulty": "hard",
        "ideal_answer_points": ["Base62 encoding", "Database schema", "Read-heavy workload", "Caching layer", "Analytics", "Custom aliases", "Expiration"]
    },
    {
        "text": "Explain the CAP theorem and its practical implications. How do modern distributed databases like Cassandra or CockroachDB make their trade-offs?",
        "role_track": "software_engineering",
        "topic": "distributed_systems",
        "difficulty": "hard",
        "ideal_answer_points": ["Consistency, Availability, Partition tolerance", "Can only guarantee 2 of 3", "CP vs AP systems", "Real-world trade-offs"]
    },
    {
        "text": "What is dynamic programming? Walk me through solving the longest common subsequence problem, explaining your thought process at each step.",
        "role_track": "software_engineering",
        "topic": "algorithms",
        "difficulty": "hard",
        "ideal_answer_points": ["Overlapping subproblems", "Optimal substructure", "Memoization vs tabulation", "2D table construction", "O(m*n) complexity"]
    },

    # --- Frontend: Easy ---
    {
        "text": "What is the DOM? How does JavaScript interact with it to make web pages dynamic?",
        "role_track": "frontend",
        "topic": "web_fundamentals",
        "difficulty": "easy",
        "ideal_answer_points": ["Document Object Model", "Tree structure of HTML", "querySelector/getElementById", "Event listeners"]
    },
    {
        "text": "Explain the CSS box model. What is the difference between margin, padding, and border?",
        "role_track": "frontend",
        "topic": "css",
        "difficulty": "easy",
        "ideal_answer_points": ["Content -> Padding -> Border -> Margin", "box-sizing: border-box", "Margin collapse"]
    },

    # --- Frontend: Medium ---
    {
        "text": "Explain React's virtual DOM and reconciliation process. Why is it faster than direct DOM manipulation?",
        "role_track": "frontend",
        "topic": "react",
        "difficulty": "medium",
        "ideal_answer_points": ["Virtual DOM is lightweight JS representation", "Diffing algorithm", "Batch updates", "Fiber architecture", "Keys for list reconciliation"]
    },
    {
        "text": "What is the difference between client-side rendering, server-side rendering, and static site generation? When would you use each?",
        "role_track": "frontend",
        "topic": "architecture",
        "difficulty": "medium",
        "ideal_answer_points": ["CSR: SPA, JS bundle renders in browser", "SSR: server renders HTML per request", "SSG: HTML generated at build time", "SEO and performance trade-offs"]
    },

    # --- Backend: Medium ---
    {
        "text": "Explain the difference between horizontal and vertical scaling. What challenges does horizontal scaling introduce?",
        "role_track": "backend",
        "topic": "infrastructure",
        "difficulty": "medium",
        "ideal_answer_points": ["Vertical = bigger machine", "Horizontal = more machines", "Load balancing", "Session management", "Data consistency"]
    },
    {
        "text": "What is database indexing? Explain how a B-tree index works and when you would NOT want to add an index.",
        "role_track": "backend",
        "topic": "databases",
        "difficulty": "medium",
        "ideal_answer_points": ["Index = data structure for fast lookups", "B-tree: balanced, sorted, O(log n)", "Write overhead", "Low cardinality columns", "Storage cost"]
    },
]

def seed():
    print(f"Seeding {len(QUESTIONS)} questions...")
    
    with psycopg.connect(DATABASE_URL) as conn:
        with conn.cursor() as cur:
            # Check if questions already exist
            cur.execute("SELECT COUNT(*) FROM questions")
            count = cur.fetchone()[0]
            if count > 0:
                print(f"Questions table already has {count} rows. Skipping seed.")
                return
            
            for i, q in enumerate(QUESTIONS):
                # Generate embedding from the question text + topic for better semantic matching
                search_text = f"{q['topic']} {q['text']}"
                embedding = model.encode(search_text).tolist()
                
                cur.execute(
                    """INSERT INTO questions (text, role_track, topic, difficulty, ideal_answer_points, embedding)
                       VALUES (%s, %s, %s, %s, %s, %s::vector)""",
                    (q["text"], q["role_track"], q["topic"], q["difficulty"],
                     json.dumps(q["ideal_answer_points"]), embedding)
                )
                print(f"  [{i+1}/{len(QUESTIONS)}] Inserted: {q['topic']}/{q['difficulty']}")
            
            conn.commit()
    
    print("Done! All questions seeded successfully.")

if __name__ == "__main__":
    seed()
