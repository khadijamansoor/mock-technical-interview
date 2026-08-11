import os
import sys
import json
import psycopg
from dotenv import load_dotenv
from sentence_transformers import SentenceTransformer

def seed_database(json_file_path):
    load_dotenv('../.env')
    DATABASE_URL = os.getenv("DATABASE_URL")
    if not DATABASE_URL:
        print("Error: DATABASE_URL not found in .env")
        sys.exit(1)

    if not os.path.exists(json_file_path):
        print(f"Error: File '{json_file_path}' not found.")
        sys.exit(1)

    with open(json_file_path, 'r', encoding='utf-8') as f:
        try:
            questions = json.load(f)
        except json.JSONDecodeError as e:
            print(f"Error parsing JSON: {e}")
            sys.exit(1)

    if not isinstance(questions, list):
        print("Error: JSON file must contain a list of question objects.")
        sys.exit(1)

    if len(questions) == 0:
        print("No questions found in JSON file.")
        sys.exit(0)

    print(f"Loading SentenceTransformer model...")
    model = SentenceTransformer('all-MiniLM-L6-v2')

    print(f"Connecting to database to insert {len(questions)} questions...")
    try:
        with psycopg.connect(DATABASE_URL) as conn:
            with conn.cursor() as cur:
                inserted_count = 0
                for i, q in enumerate(questions):
                    required_keys = ['role_track', 'topic', 'difficulty', 'text', 'ideal_answer_points']
                    if not all(k in q for k in required_keys):
                        print(f"Warning: Question {i+1} is missing required keys. Skipping. {q}")
                        continue
                    
                    # Optional round_type
                    round_type = q.get('round_type')

                    # Generate embedding
                    embedding_text = f"{q['role_track']} {q['difficulty']} {q['topic']} {q['text']}"
                    embedding = model.encode(embedding_text).tolist()
                    
                    cur.execute("""
                        INSERT INTO questions (text, role_track, round_type, topic, difficulty, ideal_answer_points, embedding)
                        VALUES (%s, %s, %s, %s, %s, %s, %s::vector)
                    """, (
                        q["text"], 
                        q["role_track"], 
                        round_type,
                        q["topic"], 
                        q["difficulty"], 
                        json.dumps(q["ideal_answer_points"]), 
                        embedding
                    ))
                    inserted_count += 1
                
                conn.commit()
                print(f"Successfully seeded {inserted_count} questions into the database!")
                
    except Exception as e:
        print(f"Database error: {e}")
        sys.exit(1)

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python seed_from_json.py <path_to_json_file>")
        sys.exit(1)
        
    seed_database(sys.argv[1])
