const express = require("express");
const { query } = require("../utils/database");
const { authenticate, allowRoles } = require("../middleware/auth");

const router = express.Router();

router.get("/users", authenticate, allowRoles("support", "admin"), async (req, res) => {
    try {
        const users = await query("SELECT id, name, email, role, created_at FROM users ORDER BY created_at DESC LIMIT 200");
        return res.json({ users });
    } catch (error) {
        return res.status(500).json({ message: "Unable to load users" });
    }
});

module.exports = router;
