import psycopg
import os
from dotenv import load_dotenv

load_dotenv("../.env")
DATABASE_URL = os.getenv("DATABASE_URL")

with open("../migrations/006_apply_addendum_schema.sql", "r") as f:
    sql = f.read()

with psycopg.connect(DATABASE_URL) as conn:
    conn.execute(sql)
    conn.commit()

print("Migration applied successfully.")
