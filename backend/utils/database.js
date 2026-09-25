const db = require("../db");

function query(sql, values = []) {
    return new Promise((resolve, reject) => {
        db.query(sql, values, (error, results) => {
            if (error) return reject(error);
            resolve(results);
        });
    });
}

module.exports = { query };
