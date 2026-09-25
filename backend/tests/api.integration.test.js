const { after, before, test } = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");

if (process.env.RUN_API_INTEGRATION_TESTS !== "1") {
    test("API integration tests require RUN_API_INTEGRATION_TESTS=1", { skip: true }, () => {});
} else {
    require("dotenv").config({ quiet: true });

    const bcrypt = require("bcrypt");
    process.env.JWT_SECRET ||= crypto.randomBytes(48).toString("base64url");
    const db = require("../db");
    const app = require("../server");

    const runId = crypto.randomBytes(8).toString("hex");
    const temporaryUsers = [];
    const temporaryEmails = [];
    let server;
    let baseUrl;
    let customer;
    let otherCustomer;
    let agent;
    let customerCookie;
    let otherCustomerCookie;
    let agentCookie;
    let ownedTicketId;

    function query(sql, values = []) {
        return new Promise((resolve, reject) => {
            db.query(sql, values, (error, rows) => error ? reject(error) : resolve(rows));
        });
    }

    async function request(path, { method = "GET", body, cookie } = {}) {
        const response = await fetch(`${baseUrl}${path}`, {
            method,
            headers: {
                ...(body ? { "Content-Type": "application/json" } : {}),
                ...(cookie ? { Cookie: cookie } : {})
            },
            body: body ? JSON.stringify(body) : undefined
        });
        const data = await response.json().catch(() => ({}));
        return {
            response,
            data,
            cookie: response.headers.get("set-cookie")?.split(";")[0]
        };
    }

    async function register(user) {
        temporaryEmails.push(user.email);
        const result = await request("/api/auth/register", {
            method: "POST",
            body: { name: user.name, email: user.email, password: user.password }
        });
        assert.equal(result.response.status, 201);
        user.id = result.data.userId;
        temporaryUsers.push(user.id);
        return user;
    }

    async function login(user) {
        const result = await request("/api/auth/login", {
            method: "POST",
            body: { email: user.email, password: user.password }
        });
        assert.equal(result.response.status, 200);
        assert.ok(result.cookie);
        return result.cookie;
    }

    before(async () => {
        await new Promise((resolve, reject) => db.ping((error) => error ? reject(error) : resolve()));

        server = app.listen(0, "127.0.0.1");
        await new Promise((resolve, reject) => {
            server.once("listening", resolve);
            server.once("error", reject);
        });
        baseUrl = `http://127.0.0.1:${server.address().port}`;

        customer = await register({
            name: "API Test Customer",
            email: `api-test-customer-${runId}@example.invalid`,
            password: crypto.randomBytes(18).toString("hex")
        });
        otherCustomer = await register({
            name: "API Test Other Customer",
            email: `api-test-other-${runId}@example.invalid`,
            password: crypto.randomBytes(18).toString("hex")
        });
        agent = await register({
            name: "API Test Support Agent",
            email: `api-test-agent-${runId}@example.invalid`,
            password: crypto.randomBytes(18).toString("hex")
        });
        await query("UPDATE users SET role = 'support' WHERE id = ?", [agent.id]);

        customerCookie = await login(customer);
        otherCustomerCookie = await login(otherCustomer);
        agentCookie = await login(agent);

        const ticket = await request("/api/tickets", {
            method: "POST",
            cookie: customerCookie,
            body: {
                subject: "API integration fixture",
                description: "Temporary ticket used by the integration test suite.",
                priority: "medium",
                category: "general"
            }
        });
        assert.equal(ticket.response.status, 201);
        ownedTicketId = ticket.data.ticketId;
    });

    after(async () => {
        try {
            if (server?.listening) {
                await new Promise((resolve) => server.close(resolve));
            }

            if (temporaryEmails.length) {
                const placeholders = temporaryEmails.map(() => "?").join(", ");
                const rows = await query(`SELECT id FROM users WHERE email IN (${placeholders})`, temporaryEmails);
                const ids = [...new Set([...temporaryUsers, ...rows.map((row) => row.id)])];
                if (ids.length) {
                    const idPlaceholders = ids.map(() => "?").join(", ");
                    await query(
                        `DELETE FROM tickets WHERE user_id IN (${idPlaceholders}) OR assigned_to IN (${idPlaceholders})`,
                        [...ids, ...ids]
                    );
                    await query(`DELETE FROM users WHERE id IN (${idPlaceholders})`, ids);
                }
            }
        } finally {
            await new Promise((resolve) => db.end(() => resolve()));
        }
    });

    test("registration succeeds and stores a bcrypt password hash", async () => {
        const user = await register({
            name: "API Registration Test",
            email: `api-test-register-${runId}@example.invalid`,
            password: crypto.randomBytes(18).toString("hex")
        });
        const rows = await query("SELECT password_hash, role FROM users WHERE id = ?", [user.id]);
        assert.equal(rows[0].role, "user");
        assert.notEqual(rows[0].password_hash, user.password);
        assert.equal(await bcrypt.compare(user.password, rows[0].password_hash), true);
    });

    test("valid login returns an HttpOnly JWT cookie", async () => {
        const result = await request("/api/auth/login", {
            method: "POST",
            body: { email: customer.email, password: customer.password }
        });
        assert.equal(result.response.status, 200);
        assert.match(result.response.headers.get("set-cookie") || "", /HttpOnly/i);
        assert.equal(result.data.user.role, "user");
    });

    test("invalid password is rejected", async () => {
        const result = await request("/api/auth/login", {
            method: "POST",
            body: { email: customer.email, password: "definitely-not-the-password" }
        });
        assert.equal(result.response.status, 401);
    });

    test("unauthenticated user cannot access protected tickets", async () => {
        const result = await request("/api/tickets");
        assert.equal(result.response.status, 401);
    });

    test("customer can create and retrieve a ticket", async () => {
        const created = await request("/api/tickets", {
            method: "POST",
            cookie: customerCookie,
            body: {
                subject: "Created by API integration test",
                description: "Verify ticket creation through the REST API.",
                priority: "high",
                category: "technical"
            }
        });
        assert.equal(created.response.status, 201);

        const fetched = await request(`/api/tickets/${created.data.ticketId}`, { cookie: customerCookie });
        assert.equal(fetched.response.status, 200);
        assert.equal(fetched.data.ticket.subject, "Created by API integration test");
    });

    test("customer cannot access another customer's ticket", async () => {
        const result = await request(`/api/tickets/${ownedTicketId}`, { cookie: otherCustomerCookie });
        assert.equal(result.response.status, 403);
    });

    test("customer is forbidden from support-only user administration", async () => {
        const result = await request("/api/users", { cookie: customerCookie });
        assert.equal(result.response.status, 403);
    });

    test("support agent can update ticket status", async () => {
        const result = await request(`/api/tickets/${ownedTicketId}`, {
            method: "PUT",
            cookie: agentCookie,
            body: { status: "in_progress", priority: "urgent", assigned_to: agent.id }
        });
        assert.equal(result.response.status, 200);

        const fetched = await request(`/api/tickets/${ownedTicketId}`, { cookie: agentCookie });
        assert.equal(fetched.data.ticket.status, "in_progress");
        assert.equal(fetched.data.ticket.priority, "urgent");
        assert.equal(Number(fetched.data.ticket.assigned_to), Number(agent.id));
    });

    test("invalid ticket ID returns not found", async () => {
        const result = await request("/api/tickets/2147483647", { cookie: agentCookie });
        assert.equal(result.response.status, 404);
    });
}
