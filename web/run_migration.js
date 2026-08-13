const fs = require('fs');
const { Client } = require('pg');

const run = async () => {
  const client = new Client({
    connectionString: "postgresql://postgres.pewoovryaebkhrorpalf:%2BEe7%26cB%40MhywheH@52.74.252.201:6543/postgres"
  });
  await client.connect();
  const sql = fs.readFileSync('../migrations/009_link_sessions_to_resume_jd.sql', 'utf8');
  await client.query(sql);
  await client.end();
  console.log("Migration 009 applied successfully.");
};

run().catch(console.error);
