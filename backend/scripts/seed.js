require("dotenv").config();

const bcrypt = require("bcrypt");
const { query } = require("../utils/database");
const db = require("../db");

const seedAccounts = [
    { prefix: "SEED_CUSTOMER", role: "user" },
    { prefix: "SEED_SUPPORT", role: "support" },
    { prefix: "SEED_ADMIN", role: "admin" }
];

async function upsertAccount({ prefix, role }) {
    const name = process.env[`${prefix}_NAME`];
    const email = process.env[`${prefix}_EMAIL`]?.trim().toLowerCase();
    const password = process.env[`${prefix}_PASSWORD`];
    if (!name || !email || !password) throw new Error("Missing sample account configuration");

    const passwordHash = await bcrypt.hash(password, 12);
    const found = await query("SELECT id FROM users WHERE email = ? LIMIT 1", [email]);
    if (found.length) {
        await query("UPDATE users SET name = ?, password_hash = ?, role = ? WHERE id = ?", [name, passwordHash, role, found[0].id]);
        return found[0].id;
    }
    const result = await query(
        "INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)",
        [name, email, passwordHash, role]
    );
    return result.insertId;
}

async function seed() {
    try {
        const customerId = await upsertAccount(seedAccounts[0]);
        await upsertAccount(seedAccounts[1]);
        await upsertAccount(seedAccounts[2]);

        const subject = "Sample: unable to access account";
        const existingTickets = await query("SELECT id FROM tickets WHERE user_id = ? AND subject = ? LIMIT 1", [customerId, subject]);
        let ticketId = existingTickets[0]?.id;
        if (!ticketId) {
            const ticket = await query(
                "INSERT INTO tickets (user_id, subject, description, priority, category, status) VALUES (?, ?, ?, 'medium', 'account', 'open')",
                [customerId, subject, "This sample ticket is here to demonstrate the support workflow."]
            );
            ticketId = ticket.insertId;
        }

        const existingComments = await query("SELECT id FROM ticket_comments WHERE ticket_id = ? LIMIT 1", [ticketId]);
        if (!existingComments.length) {
            await query("INSERT INTO ticket_comments (ticket_id, user_id, comment) VALUES (?, ?, ?)", [ticketId, customerId, "I have included this sample comment to show the ticket conversation."]);
        }
        console.log(`Sample customer, support agent, admin, ticket, and comment are ready. Sample ticket ID: ${ticketId}`);
    } catch (error) {
        console.error("Sample data setup failed. Check your local configuration, schema, and database connection.");
        process.exitCode = 1;
    } finally {
        db.end(() => {});
    }
}

seed();
