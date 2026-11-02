'use strict';

function bindParams(params) {
    const bound = {};
    for (const [key, value] of Object.entries(params || {})) {
        if (value !== undefined && value !== null) bound[':' + key] = value;
    }
    return bound;
}

function queryAll(db, sqlText, params = {}) {
    const stmt = db.prepare(sqlText);
    const bound = bindParams(params);
    if (Object.keys(bound).length > 0) {
        stmt.bind(bound);
    }
    stmt.getColumnNames();
    const rows = [];
    while (stmt.step()) {
        rows.push(stmt.getAsObject());
    }
    stmt.reset();
    stmt.free();
    return rows;
}

module.exports = { bindParams, queryAll };
