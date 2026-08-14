const fs = require('fs');
const { Client } = require('pg');

const run = async () => {
  const client = new Client({
    connectionString: "postgresql://postgres.pewoovryaebkhrorpalf:%2BEe7%26cB%40MhywheH@52.74.252.201:6543/postgres"
  });
  await client.connect();
  const sql = fs.readFileSync('../migrations/010_add_supabase_user_id.sql', 'utf8');
  await client.query(sql);
  await client.end();
  console.log("Migration 010 applied successfully.");
};

run().catch(console.error);
