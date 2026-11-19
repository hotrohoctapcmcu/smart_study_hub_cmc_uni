"use strict";

const IU_ORIGIN = "https://iu.cmcu.edu.vn";
const STUDENT_PATH = "/sinhvien/congsinhvien";
const IU_URL = IU_ORIGIN + STUDENT_PATH;
const LEGACY_IU_URL = IU_ORIGIN + "/congthongtin/Index.aspx";
const STUDENT_API_URL = IU_ORIGIN + "/sinhvien/api/";
const MS_LOGIN_URL = "https://www.office.com/";
const CMC_PARTITION = "persist:cmc-portal";

function portalFromUrl(url) {
    let current;
    try { current = new URL(url); } catch { return null; }
    if (current.origin !== IU_ORIGIN) return null;
    const path = current.pathname;
    if (path === STUDENT_PATH || path.startsWith(STUDENT_PATH + "/")) return "sinhvien";
    if (/^\/congthongtin\//i.test(path)) return "legacy";
    return null;
}

module.exports = { IU_ORIGIN, STUDENT_PATH, IU_URL, LEGACY_IU_URL, STUDENT_API_URL, MS_LOGIN_URL, CMC_PARTITION, portalFromUrl };
