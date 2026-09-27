const mysql = require("mysql2");

require("dotenv").config();

const db = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT,
    // TiDB Cloud Starter requires TLS on its public endpoint.
    ssl: process.env.DB_SSL === "true" ? { minVersion: "TLSv1.2" } : undefined,
    waitForConnections: true,
    connectionLimit: 5,
    maxIdle: 1,
    // Retire idle sockets before TiDB Cloud's gateway can close them.
    idleTimeout: 30_000,
    enableKeepAlive: true,
    keepAliveInitialDelay: 0
});

db.on("connection", (connection) => {
    connection.on("error", (error) => {
        console.error(`MySQL connection error: ${error.code || "UNKNOWN"}`);
    });
});

// Keep the ping interface used by the health endpoint and existing DB scripts.
db.ping = (callback) => db.query("SELECT 1", callback);

db.query("SELECT 1", (err) => {
    if (err) {
        console.log("Database connection failed. Check the local database configuration and availability.");
    } else {
        console.log("MySQL database connected successfully!");
    }
});

module.exports = db;
