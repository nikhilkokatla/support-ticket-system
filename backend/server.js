const express = require("express");
const cors = require("cors");
const path = require("path");
require("dotenv").config();

const db = require("./db");
const registerRouter = require("./auth/register");
const authRouter = require("./auth/auth");
const ticketRouter = require("./tickets/routes");
const usersRouter = require("./users/routes");

const app = express();

function ensureResolvedTicketStatus() {
    return new Promise((resolve, reject) => {
        db.query("SHOW COLUMNS FROM tickets LIKE 'status'", (error, columns) => {
            if (error) return reject(error);
            const statusType = columns[0]?.Type || "";
            if (!statusType.includes("'completed'")) return resolve(false);

            db.query("UPDATE tickets SET status = 'resolved' WHERE status = 'completed'", (updateError) => {
                if (updateError) return reject(updateError);
                db.query(
                    "ALTER TABLE tickets MODIFY COLUMN status ENUM('open', 'in_progress', 'resolved', 'closed') NOT NULL DEFAULT 'open'",
                    (migrationError) => migrationError ? reject(migrationError) : resolve(true)
                );
            });
        });
    });
}

app.use(cors({
    origin: process.env.FRONTEND_URL || "http://localhost:5173",
    credentials: true
}));
app.use(express.json());
app.use("/", registerRouter);
app.use("/", authRouter);
app.use("/api/auth", registerRouter);
app.use("/api/auth", authRouter);
app.use("/api", ticketRouter);
app.use("/api", usersRouter);
app.use("/api", (req, res) => res.status(404).json({ message: "API endpoint not found" }));

const frontendBuild = path.join(__dirname, "../frontend/dist");

app.get("/", (req, res) => {
    res.sendFile(path.join(frontendBuild, "index.html"), (error) => {
        if (error && !res.headersSent) res.json({ message: "Support Ticket API is running" });
    });
});

app.get("/health", (req, res) => {
    db.ping((error) => {
        if (error) return res.status(503).json({ status: "unavailable", message: "Database connection is not ready" });
        return res.json({ status: "ok" });
    });
});

app.use(express.static(frontendBuild));
app.use((req, res, next) => {
    if (req.method !== "GET" || req.path === "/api" || req.path.startsWith("/api/")) return next();
    return res.sendFile(path.join(frontendBuild, "index.html"), (error) => {
        if (error) next();
    });
});

app.use((error, req, res, next) => {
    if (req.path.startsWith("/api/")) {
        const status = Number.isInteger(error.status) && error.status >= 400 && error.status < 500 ? error.status : 500;
        return res.status(status).json({ message: status < 500 ? error.message : "Request could not be completed" });
    }
    return next(error);
});

if (require.main === module) {
    const PORT = Number(process.env.PORT || 5000);

    ensureResolvedTicketStatus()
        .then((migrated) => {
            console.log(migrated ? "Migrated completed tickets to resolved and removed completed status." : "Ticket status schema is current.");
            app.listen(PORT, "0.0.0.0", () => {
                console.log(`Server listening on port ${PORT}`);
            });
        })
        .catch((error) => {
            console.error("Unable to verify ticket status schema:", error.code || "UNKNOWN", error.sqlState || "");
            db.end(() => { process.exitCode = 1; });
        });
}

module.exports = app;
