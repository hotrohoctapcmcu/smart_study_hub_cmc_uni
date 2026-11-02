"use strict";

/**
 * data/index.js — Cum DU LIEU IU: goi portal truc tiep + map ve schema.
 * File tong ket cua folder data/; noi khac chi dung qua ../index.js (diem duy nhat).
 */

const { schemaRong } = require("./schema");
const maps = require("./maps");
const { goiIU, layData } = require("./client");
const fetchFns = require("./fetch");

module.exports = {
    schemaRong,
    goiIU,
    layData,
    ...maps,
    ...fetchFns,
};
