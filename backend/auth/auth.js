const express = require("express");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const db = require("../db");

const router = express.Router();
const cookieName = "support_ticket_token";
const cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/"
};

function getTokenFromRequest(req) {
    const cookieHeader = req.headers.cookie || "";
    const cookie = cookieHeader
        .split(";")
        .map((part) => part.trim())
        .find((part) => part.startsWith(`${cookieName}=`));

    return cookie ? cookie.slice(cookieName.length + 1) : null;
}

function getUserFromDatabase(email) {
    return new Promise((resolve, reject) => {
        db.query(
            "SELECT id, name, email, password_hash, role FROM users WHERE LOWER(email) = ? LIMIT 1",
            [email],
            (error, rows) => error ? reject(error) : resolve(rows[0])
        );
    });
}

function getPublicUser(userId) {
    return new Promise((resolve, reject) => {
        db.query(
            "SELECT id, name, email, role FROM users WHERE id = ? LIMIT 1",
            [userId],
            (error, rows) => error ? reject(error) : resolve(rows[0])
        );
    });
}

router.post("/login", async (req, res) => {
    const { email, password } = req.body || {};

    if (typeof email !== "string" || typeof password !== "string" || !email.trim() || !password) {
        return res.status(400).json({ message: "Email and password are required" });
    }

    if (!process.env.JWT_SECRET) {
        return res.status(503).json({ message: "Authentication is not configured on the server" });
    }

    try {
        const user = await getUserFromDatabase(email.trim().toLowerCase());
        const passwordMatches = user && await bcrypt.compare(password, user.password_hash);

        if (!passwordMatches) {
            return res.status(401).json({ message: "Invalid email or password" });
        }

        const token = jwt.sign(
            { sub: String(user.id), role: user.role },
            process.env.JWT_SECRET,
            { expiresIn: "8h" }
        );

        res.cookie(cookieName, token, { ...cookieOptions, maxAge: 8 * 60 * 60 * 1000 });
        return res.json({
            message: "Login successful",
            user: { id: user.id, name: user.name, email: user.email, role: user.role }
        });
    } catch (error) {
        return res.status(500).json({ message: "Unable to log in right now" });
    }
});

router.get("/me", async (req, res) => {
    if (!process.env.JWT_SECRET) {
        return res.status(503).json({ message: "Authentication is not configured on the server" });
    }

    const token = getTokenFromRequest(req);
    if (!token) {
        return res.status(401).json({ message: "Not logged in" });
    }

    try {
        const payload = jwt.verify(token, process.env.JWT_SECRET);
        const user = await getPublicUser(payload.sub);
        if (!user) {
            res.clearCookie(cookieName, cookieOptions);
            return res.status(401).json({ message: "Not logged in" });
        }
        return res.json({ user });
    } catch (error) {
        res.clearCookie(cookieName, cookieOptions);
        return res.status(401).json({ message: "Not logged in" });
    }
});

router.post("/logout", (req, res) => {
    res.clearCookie(cookieName, cookieOptions);
    return res.json({ message: "Logged out successfully" });
});

module.exports = router;
