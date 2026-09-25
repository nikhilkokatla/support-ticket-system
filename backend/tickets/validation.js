const priorities = ["low", "medium", "high", "urgent"];
const categories = ["account", "billing", "technical", "general"];
const statuses = ["open", "in_progress", "resolved", "closed"];

function validateTicketFields(fields, { partial = false, staff = false } = {}) {
    const errors = [];
    const allowed = new Set(["subject", "description", "priority", "category"]);
    if (staff) {
        allowed.add("status");
        allowed.add("assigned_to");
    }

    for (const key of Object.keys(fields)) {
        if (!allowed.has(key)) errors.push(`Field '${key}' cannot be changed`);
    }

    if (!partial || "subject" in fields) {
        if (typeof fields.subject !== "string" || fields.subject.trim().length < 3 || fields.subject.trim().length > 150) {
            errors.push("Subject must be between 3 and 150 characters");
        }
    }
    if (!partial || "description" in fields) {
        if (typeof fields.description !== "string" || fields.description.trim().length < 10 || fields.description.trim().length > 5000) {
            errors.push("Description must be between 10 and 5000 characters");
        }
    }
    if (!partial || "priority" in fields) {
        if (!priorities.includes(fields.priority)) errors.push("Choose a valid priority");
    }
    if (!partial || "category" in fields) {
        if (!categories.includes(fields.category)) errors.push("Choose a valid category");
    }
    if (staff && "status" in fields && !statuses.includes(fields.status)) {
        errors.push("Choose a valid status");
    }
    if (staff && "assigned_to" in fields && fields.assigned_to !== null && fields.assigned_to !== "" && !Number.isInteger(Number(fields.assigned_to))) {
        errors.push("Assignee must be a valid user id or empty");
    }

    return errors;
}

module.exports = { priorities, categories, statuses, validateTicketFields };
