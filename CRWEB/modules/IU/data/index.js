"use strict";

/**
 * data/index.js — Cum DU LIEU IU: goi portal truc tiep + map ve schema.
 * File tong ket cua folder data/; noi khac chi dung qua ../index.js (diem duy nhat).
 */

const { schemaRong } = require("./schema");
const maps = require("./maps");
const { goiIU, layData } = require("./client");
const legacy = require("./fetch");
const student = require("./student");

const fetchFns = Object.fromEntries(Object.entries(legacy).map(([name, fetchLegacy]) => [
    name, (session, cookie, opts = {}) => session?.portal === "sinhvien"
        ? student[name](cookie, opts) : fetchLegacy(session, cookie, opts),
]));

module.exports = {
    schemaRong,
    goiIU,
    layData,
    ...maps,
    ...fetchFns,
};
