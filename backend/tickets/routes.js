const express = require("express");
const { query } = require("../utils/database");
const { authenticate, allowRoles } = require("../middleware/auth");
const { validateTicketFields, priorities, categories, statuses } = require("./validation");
const { isStaff, canReadTicket, canEditTicket, canDeleteTicket } = require("./permissions");

const router = express.Router();
const staffRoles = ["support", "admin"];
const ticketSelect = `
    SELECT t.id, t.subject, t.subject AS title, t.description, t.priority, t.category, t.status,
           t.user_id, t.user_id AS created_by, t.assigned_to, t.created_at, t.updated_at,
           creator.name AS creator_name, assignee.name AS assignee_name
    FROM tickets t
    JOIN users creator ON creator.id = t.user_id
    LEFT JOIN users assignee ON assignee.id = t.assigned_to
`;

function normalizeFields(input) {
    const fields = { ...(input || {}) };
    if (!Object.hasOwn(fields, "subject") && Object.hasOwn(fields, "title")) fields.subject = fields.title;
    delete fields.title;
    return fields;
}

router.use(authenticate);

router.get("/tickets", async (req, res) => {
    try {
        const values = [];
        const conditions = [];
        if ((req.query.status && !statuses.includes(req.query.status)) ||
            (req.query.priority && !priorities.includes(req.query.priority)) ||
            (req.query.category && !categories.includes(req.query.category))) {
            return res.status(400).json({ message: "Invalid ticket filter" });
        }
        if (req.query.sort && !["updated", "created", "priority", "status"].includes(req.query.sort)) {
            return res.status(400).json({ message: "Invalid sort field" });
        }
        if (!isStaff(req.user)) {
            conditions.push("t.user_id = ?");
            values.push(req.user.id);
        }

        const { status, priority, category, search } = req.query;
        if (status && statuses.includes(status)) {
            conditions.push("t.status = ?");
            values.push(status);
        }
        if (priority && priorities.includes(priority)) {
            conditions.push("t.priority = ?");
            values.push(priority);
        }
        if (category && categories.includes(category)) {
            conditions.push("t.category = ?");
            values.push(category);
        }
        if (search && typeof search !== "string") return res.status(400).json({ message: "Search must be a single string" });
        if (typeof search === "string" && search.length > 200) return res.status(400).json({ message: "Search must be 200 characters or fewer" });
        if (typeof search === "string" && search.trim()) {
            conditions.push("(t.subject LIKE ? OR t.description LIKE ?)");
            values.push(`%${search.trim()}%`, `%${search.trim()}%`);
        }

        const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
        const sortOptions = { updated: "t.updated_at", created: "t.created_at", priority: "FIELD(t.priority, 'urgent', 'high', 'medium', 'low')", status: "FIELD(t.status, 'open', 'in_progress', 'resolved', 'closed')" };
        const sort = sortOptions[req.query.sort] || sortOptions.updated;
        const direction = req.query.order === "asc" ? "ASC" : "DESC";
        const tickets = await query(`${ticketSelect} ${where} ORDER BY ${sort} ${direction}, t.id DESC LIMIT 100`, values);
        return res.json({ tickets });
    } catch (error) {
        return res.status(500).json({ message: "Unable to load tickets" });
    }
});

router.post("/tickets", async (req, res) => {
    const fields = normalizeFields(req.body);
    const errors = validateTicketFields(fields);
    if (errors.length) return res.status(400).json({ message: errors[0], errors });

    try {
        const result = await query(
            `INSERT INTO tickets (subject, description, priority, category, status, user_id)
             VALUES (?, ?, ?, ?, 'open', ?)`,
            [fields.subject.trim(), fields.description.trim(), fields.priority, fields.category, req.user.id]
        );
        return res.status(201).json({ message: "Ticket created", ticketId: result.insertId });
    } catch (error) {
        console.error("Ticket creation failed:", error.code || "UNKNOWN", error.sqlState || "");
        return res.status(500).json({ message: "Unable to create ticket" });
    }
});

router.get("/tickets/:id", async (req, res) => {
    try {
        const rows = await query(`${ticketSelect} WHERE t.id = ? LIMIT 1`, [req.params.id]);
        const ticket = rows[0];
        if (!ticket) return res.status(404).json({ message: "Ticket not found" });
        if (!canReadTicket(req.user, ticket)) {
            return res.status(403).json({ message: "You cannot view this ticket" });
        }
        return res.json({ ticket });
    } catch (error) {
        return res.status(500).json({ message: "Unable to load ticket" });
    }
});

async function canAccessTicket(ticketId, user) {
    const tickets = await query("SELECT id, user_id FROM tickets WHERE id = ? LIMIT 1", [ticketId]);
    const ticket = tickets[0];
    if (!ticket) return { ticket: null, allowed: false };
    return { ticket, allowed: canReadTicket(user, ticket) };
}

router.get("/tickets/:id/comments", async (req, res) => {
    try {
        const access = await canAccessTicket(req.params.id, req.user);
        if (!access.ticket) return res.status(404).json({ message: "Ticket not found" });
        if (!access.allowed) return res.status(403).json({ message: "You cannot view comments on this ticket" });
        const comments = await query(
            `SELECT c.id, c.ticket_id, c.user_id, c.comment, c.created_at, u.name AS author_name, u.role AS author_role
             FROM ticket_comments c JOIN users u ON u.id = c.user_id
             WHERE c.ticket_id = ? ORDER BY c.created_at ASC, c.id ASC`,
            [req.params.id]
        );
        return res.json({ comments });
    } catch (error) {
        return res.status(500).json({ message: "Unable to load ticket comments" });
    }
});

router.post("/tickets/:id/comments", async (req, res) => {
    const comment = typeof req.body?.comment === "string" ? req.body.comment.trim() : "";
    if (!comment || comment.length > 4000) {
        return res.status(400).json({ message: "Comment must be between 1 and 4000 characters" });
    }
    try {
        const access = await canAccessTicket(req.params.id, req.user);
        if (!access.ticket) return res.status(404).json({ message: "Ticket not found" });
        if (!access.allowed) return res.status(403).json({ message: "You cannot comment on this ticket" });
        const result = await query(
            "INSERT INTO ticket_comments (ticket_id, user_id, comment) VALUES (?, ?, ?)",
            [req.params.id, req.user.id, comment]
        );
        return res.status(201).json({ message: "Comment added", commentId: result.insertId });
    } catch (error) {
        return res.status(500).json({ message: "Unable to add comment" });
    }
});

router.get("/dashboard/stats", allowRoles(...staffRoles), async (req, res) => {
    try {
        const [totals, byStatus, unassigned] = await Promise.all([
            query("SELECT COUNT(*) AS total FROM tickets"),
            query("SELECT status, COUNT(*) AS total FROM tickets GROUP BY status"),
            query("SELECT COUNT(*) AS total FROM tickets WHERE assigned_to IS NULL AND status IN ('open', 'in_progress')")
        ]);
        return res.json({ total: totals[0].total, unassigned: unassigned[0].total, byStatus });
    } catch (error) {
        return res.status(500).json({ message: "Unable to load dashboard statistics" });
    }
});

const updateTicket = async (req, res) => {
    const staff = staffRoles.includes(req.user.role);
    const fields = normalizeFields(req.body);
    const errors = validateTicketFields(fields, { partial: true, staff });
    if (errors.length || !Object.keys(fields).length) {
        return res.status(400).json({ message: errors[0] || "Provide at least one field to update", errors });
    }

    try {
        const rows = await query("SELECT id, user_id, status FROM tickets WHERE id = ? LIMIT 1", [req.params.id]);
        const ticket = rows[0];
        if (!ticket) return res.status(404).json({ message: "Ticket not found" });
        if (!canReadTicket(req.user, ticket)) {
            return res.status(403).json({ message: "You cannot update this ticket" });
        }
        if (!canEditTicket(req.user, ticket)) {
            return res.status(409).json({ message: "Only open tickets can be edited by their requester" });
        }

        if ("assigned_to" in fields && fields.assigned_to !== null && fields.assigned_to !== "") {
            const assignees = await query("SELECT id FROM users WHERE id = ? AND role IN ('support', 'admin')", [fields.assigned_to]);
            if (!assignees.length) return res.status(400).json({ message: "Assignee must be a support user" });
        }

        const keys = Object.keys(fields);
        const values = keys.map((key) => key === "assigned_to" && fields[key] === "" ? null : fields[key]);
        const assignments = keys.map((key) => `${key} = ?`).join(", ");
        values.push(req.params.id);
        await query(`UPDATE tickets SET ${assignments} WHERE id = ?`, values);
        return res.json({ message: "Ticket updated" });
    } catch (error) {
        return res.status(500).json({ message: "Unable to update ticket" });
    }
};

router.patch("/tickets/:id", updateTicket);
router.put("/tickets/:id", updateTicket);

router.delete("/tickets/:id", async (req, res) => {
    try {
        const rows = await query("SELECT id, user_id, status FROM tickets WHERE id = ? LIMIT 1", [req.params.id]);
        const ticket = rows[0];
        if (!ticket) return res.status(404).json({ message: "Ticket not found" });
        if (!canDeleteTicket(req.user, ticket)) {
            return res.status(403).json({ message: "Only admins can delete this ticket" });
        }
        await query("DELETE FROM tickets WHERE id = ?", [req.params.id]);
        return res.json({ message: "Ticket deleted" });
    } catch (error) {
        return res.status(500).json({ message: "Unable to delete ticket" });
    }
});

router.get("/staff/options", allowRoles(...staffRoles), async (req, res) => {
    try {
        const staff = await query("SELECT id, name, email, role FROM users WHERE role IN ('support', 'admin') ORDER BY name");
        return res.json({ staff, priorities, categories, statuses });
    } catch (error) {
        return res.status(500).json({ message: "Unable to load staff options" });
    }
});

module.exports = router;
