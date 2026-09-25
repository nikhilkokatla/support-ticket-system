const staffRoles = ["support", "admin"];

function isStaff(user) {
    return staffRoles.includes(user?.role);
}

function canReadTicket(user, ticket) {
    return isStaff(user) || Number(user?.id) === Number(ticket?.user_id);
}

function canEditTicket(user, ticket) {
    return isStaff(user) || (Number(user?.id) === Number(ticket?.user_id) && ticket?.status === "open");
}

function canDeleteTicket(user, ticket) {
    return user?.role === "admin" || (Number(user?.id) === Number(ticket?.user_id) && ticket?.status === "open");
}

module.exports = { isStaff, canReadTicket, canEditTicket, canDeleteTicket };
