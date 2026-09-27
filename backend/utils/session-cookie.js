function getSessionCookieOptions() {
    const secure = process.env.NODE_ENV === "production";

    return {
        httpOnly: true,
        secure,
        sameSite: secure ? "none" : "lax",
        // The frontend and API use separate onrender.com hosts. Partitioning
        // lets modern browsers send this credential to the API from the
        // frontend while respecting third-party cookie restrictions.
        ...(secure ? { partitioned: true } : {}),
        path: "/"
    };
}

module.exports = { getSessionCookieOptions };
