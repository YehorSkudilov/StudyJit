import mysql from "mysql2/promise";

const db = mysql.createPool({
  host: process.env.APP_NAME + "-mysql",
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
});

export default db;
