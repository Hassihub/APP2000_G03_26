import pkg from "pg";
import dbConfigModule from "./db-config.cjs";

const { Pool } = pkg;
const { getDatabaseConfig } = dbConfigModule;

const pool = new Pool(getDatabaseConfig());

export default pool;
