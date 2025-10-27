import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load the root .env no matter where we run from
dotenv.config({ path: path.join(__dirname, "..", ".env") });

import "dotenv/config";
import { readFile } from "fs/promises";
import pg from "pg";
const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl:
    process.env.NODE_ENV === "production"
      ? { rejectUnauthorized: false }
      : false,
});

const sql = await readFile(new URL("./schema.sql", import.meta.url), "utf8");

const client = await pool.connect();
try {
  await client.query(sql);
  console.log("✅ Migration applied");
} finally {
  client.release();
  await pool.end();
}
