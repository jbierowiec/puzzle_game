import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load the root .env no matter where we run from
dotenv.config({ path: path.join(__dirname, "..", ".env") });

import express from "express";
import cors from "cors";
import pkg from "pg";
import "dotenv/config";
const { Pool } = pkg;

const app = express();
app.use(cors());
app.use(express.json());

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// ✅ health check
app.get("/", (req, res) => {
  res.send("API OK");
});

// ✅ puzzles endpoint
app.get("/api/puzzles", async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, name, difficulty, zip_path AS "zipPath" FROM puzzles`
    );
    res.json(result.rows);
  } catch (err) {
    console.error("Error fetching puzzles:", err);
    res.status(500).json({ error: "Database query failed" });
  }
});

const PORT = process.env.PORT || 5050;
app.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
});
