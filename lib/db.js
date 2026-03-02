import pkg from "pg";

const { Pool } = pkg;

const isProd = process.env.NODE_ENV === "production";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // CockroachDB on platforms like Heroku usually works best with
  // rejectUnauthorized: false; locally we often don't use SSL at all.
  ssl: isProd ? { rejectUnauthorized: false } : false,
});

export default pool;
