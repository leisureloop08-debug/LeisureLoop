const { Pool } = require("pg");

let pool;
function db() {
  if (!process.env.DATABASE_URL) {
    const error = new Error("Database is not configured.");
    error.statusCode = 503;
    throw error;
  }
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.DATABASE_SSL === "disable" ? false : { rejectUnauthorized: true },
      max: 5,
      idleTimeoutMillis: 10000,
      connectionTimeoutMillis: 5000
    });
  }
  return pool;
}
module.exports = { db };
