"use strict";

const { quoteIdentifier } = require("../utils/study-context");

async function loadOptionalTable(database, candidates, studentId) {
    if (typeof database.executeQuery !== "function") {
        return { available: false, rows: [], reason: "query-not-supported" };
    }

    const tables = await database.executeQuery("SELECT name FROM sqlite_master WHERE type = 'table'");
    const byLowerName = new Map((tables || []).map(item => [String(item.name).toLowerCase(), item.name]));
    const tableName = candidates.map(name => byLowerName.get(name.toLowerCase())).find(Boolean);
    if (!tableName) return { available: false, rows: [], reason: "table-not-found" };

    const columns = await database.executeQuery(`PRAGMA table_info(${quoteIdentifier(tableName)})`);
    const names = new Set((columns || []).map(column => String(column.name)));
    const ownerColumn = ["student_id", "user_id", "owner_id"].find(name => names.has(name));
    if (!ownerColumn) {
        return { available: false, rows: [], reason: "owner-column-not-found", table: tableName };
    }

    const orderColumn = ["updated_at", "created_at", "uploaded_at", "id"]
        .find(name => names.has(name));
    const sql = [
        `SELECT * FROM ${quoteIdentifier(tableName)}`,
        `WHERE ${quoteIdentifier(ownerColumn)} = @studentId`,
        orderColumn ? `ORDER BY ${quoteIdentifier(orderColumn)} DESC` : ""
    ].filter(Boolean).join(" ");

    return {
        available: true,
        rows: await database.executeQuery(sql, { studentId: String(studentId) }),
        table: tableName
    };
}


module.exports = { loadOptionalTable };
