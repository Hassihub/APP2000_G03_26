const path = require("path");

function ensureDatabaseUrl() {
  if (!process.env.DATABASE_URL) {
    try {
      require("dotenv").config({
        path: path.resolve(__dirname, "..", ".env"),
      });
    } catch (error) {
      // ignore dotenv loading failures here; the explicit error below is clearer
    }
  }

  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL mangler. Sett Cockroach-tilkoblingen i .env.");
  }

  return process.env.DATABASE_URL;
}

function getDatabaseConfig() {
  return {
    connectionString: ensureDatabaseUrl(),
    ssl: {
      rejectUnauthorized: true,
    },
  };
}

module.exports = {
  ensureDatabaseUrl,
  getDatabaseConfig,
};