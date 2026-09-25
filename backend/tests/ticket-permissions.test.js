const test = require("node:test");
const assert = require("node:assert/strict");
const { canReadTicket, canEditTicket, canDeleteTicket } = require("../tickets/permissions");

const customer = { id: 7, role: "user" };
const ownOpenTicket = { user_id: 7, status: "open" };
const anotherTicket = { user_id: 8, status: "open" };

test("customer can read their own ticket", () => assert.equal(canReadTicket(customer, ownOpenTicket), true));
test("customer cannot read another customer's ticket", () => assert.equal(canReadTicket(customer, anotherTicket), false));
test("support staff can read tickets across customers", () => assert.equal(canReadTicket({ id: 9, role: "support" }, anotherTicket), true));
test("customer can edit an open ticket only", () => {
    assert.equal(canEditTicket(customer, ownOpenTicket), true);
    assert.equal(canEditTicket(customer, { ...ownOpenTicket, status: "resolved" }), false);
});
test("only admins or owners of open tickets can delete tickets", () => {
    assert.equal(canDeleteTicket(customer, ownOpenTicket), true);
    assert.equal(canDeleteTicket(customer, anotherTicket), false);
    assert.equal(canDeleteTicket({ id: 9, role: "admin" }, anotherTicket), true);
});
