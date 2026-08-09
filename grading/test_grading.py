import os
import json
import app
from unittest.mock import MagicMock, patch

mock_st = MagicMock()
patch('app.SentenceTransformer', return_value=mock_st).start()

# Seed rows to test
SEED_ROWS = [
    ("coding_dsa", "", "correctness", 0.35, "Evaluates correctness and efficiency of the code"),
    ("coding_dsa", "", "depth", 0.25, "Depth of knowledge in DSA concepts"),
    ("coding_dsa", "", "communication", 0.20, "Ability to explain thoughts clearly"),
    ("coding_dsa", "", "problem_solving", 0.20, "Approach to edge cases and debugging")
]

# Mock Database rows for session and transcript
SESSION_ROW = ("Alice", "coding_dsa", "")
TRANSCRIPT_ROWS = [
    ("interviewer", "Can you reverse a linked list?"),
    ("candidate", "Yes, we can do it iteratively by keeping track of prev, curr, and next nodes.")
]

def mock_connect(*args, **kwargs):
    conn = MagicMock()
    cursor = MagicMock()
    conn.cursor.return_value.__enter__.return_value = cursor
    
    def fetchone_side_effect():
        # First call might be checking if track_rubrics exists
        # Second call fetches candidate name
        # Third might be scorecard insert returning id
        pass

    cursor.fetchall.side_effect = [
        SEED_ROWS,       # 1. load_track_rubrics() fetches the rubrics
        TRANSCRIPT_ROWS  # 2. grade() fetches the transcript
    ]
    
    cursor.fetchone.side_effect = [
        [True],          # 1. table exists check
        SESSION_ROW,     # 2. session fetch
        ["mock-uuid"]    # 3. scorecard insert returning id
    ]
    
    return conn

# Patch psycopg and run the tests
with patch('psycopg.connect', side_effect=mock_connect):
    print("--- 1. Testing reload-rubrics ---")
    app.load_track_rubrics()
    print("Loaded TRACK_RUBRICS:", json.dumps(app.TRACK_RUBRICS, indent=2))
    
    print("\n--- 2. Testing /admin/rubrics validation (Failure case) ---")
    with app.app.test_client() as client:
        res = client.post('/admin/rubrics', json={
            "role_track": "coding_dsa",
            "round_type": "",
            "dimensions": [
                {"dimension": "correctness", "weight": 0.5},
                {"dimension": "depth", "weight": 0.4} # Sum = 0.9 (Invalid)
            ]
        })
        print("Validation response:", res.json)

    print("\n--- 3. Testing /grade ---")
    with app.app.test_client() as client:
        # Patch the Groq client to just return what we want instead of hitting the API
        # Actually, let's let it hit the real Groq API to prove it works end-to-end!
        # The prompt will use our injected dimensions.
        res = client.post('/grade', json={"session_id": "test-session-id"})
        print("\nScorecard Result:")
        print(json.dumps(res.json, indent=2))
