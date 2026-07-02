import pg from "pg";
const { Client } = pg;

const client = new Client({ connectionString: "postgresql://postgres:postgres@localhost:5432/postgres" });
await client.connect();
const res = await client.query("SELECT 1 FROM pg_database WHERE datname='kapes'");
if (res.rowCount === 0) {
  await client.query("CREATE DATABASE kapes");
  console.log("DB 'kapes' を作成しました");
} else {
  console.log("DB 'kapes' は既に存在します");
}
await client.end();
