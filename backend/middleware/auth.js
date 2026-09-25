const jwt = require("jsonwebtoken");
const { query } = require("../utils/database");

const cookieName = "support_ticket_token";

function readToken(req) {
    return (req.headers.cookie || "")
        .split(";")
        .map((part) => part.trim())
        .find((part) => part.startsWith(`${cookieName}=`))
        ?.slice(cookieName.length + 1);
}

async function authenticate(req, res, next) {
    if (!process.env.JWT_SECRET) {
        return res.status(503).json({ message: "Authentication is not configured on the server" });
    }

    const token = readToken(req);
    if (!token) return res.status(401).json({ message: "Please log in to continue" });

    let payload;
    try {
        payload = jwt.verify(token, process.env.JWT_SECRET);
    } catch (error) {
        res.clearCookie(cookieName, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/" });
        return res.status(401).json({ message: "Please log in to continue" });
    }

    try {
        const users = await query("SELECT id, name, email, role FROM users WHERE id = ? LIMIT 1", [payload.sub]);
        if (!users.length) {
            res.clearCookie(cookieName, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/" });
            return res.status(401).json({ message: "Please log in to continue" });
        }
        req.user = users[0];
        return next();
    } catch (error) {
        return res.status(500).json({ message: "Unable to verify your account right now" });
    }
}

function allowRoles(...roles) {
    return (req, res, next) => {
        if (!req.user || !roles.includes(req.user.role)) {
            return res.status(403).json({ message: "You do not have permission to do that" });
        }
        return next();
    };
}

module.exports = { authenticate, allowRoles };
