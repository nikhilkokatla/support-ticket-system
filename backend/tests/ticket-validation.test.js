const test = require("node:test");
const assert = require("node:assert/strict");
const { validateTicketFields } = require("../tickets/validation");

const validTicket = {
    subject: "Cannot access account",
    description: "The password reset link does not work for my account.",
    priority: "medium",
    category: "account"
};

test("accepts a valid ticket", () => {
    assert.deepEqual(validateTicketFields(validTicket), []);
});

test("rejects a ticket with invalid lengths or enum values", () => {
    const errors = validateTicketFields({ ...validTicket, subject: "x", priority: "critical", category: "other" });
    assert.equal(errors.length, 3);
});

test("allows customer edits to supported ticket fields", () => {
    assert.deepEqual(validateTicketFields({ subject: "Updated issue" }, { partial: true }), []);
});

test("rejects customers changing staff-only fields", () => {
    const errors = validateTicketFields({ status: "resolved", assigned_to: 2 }, { partial: true });
    assert.equal(errors.length, 2);
});

test("validates staff status and assignment values", () => {
    assert.deepEqual(validateTicketFields({ status: "closed", assigned_to: "4" }, { partial: true, staff: true }), []);
    assert.equal(validateTicketFields({ status: "waiting", assigned_to: "bad" }, { partial: true, staff: true }).length, 2);
});
