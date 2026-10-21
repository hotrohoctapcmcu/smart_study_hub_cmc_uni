"use strict";

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const COLLECTIONS = [
    "courses", "assignments", "exams", "documents", "textbook"
];

const DEFAULT_AI = {
    provider: "cookie",
    apiKey: "",
    model: "gemini-2.5-flash",
    cookieConfigured: false
};

const DEFAULT_STUDENT = {
    name: "", mssv: "", email: "", class: "", faculty: "", major: ""
};

const DEFAULT_GLOBAL = {
    activeKey: "default",
    students: [],
    settings: { ai: { ...DEFAULT_AI }, ui: { theme: "light" } }
};

let dataDir;
let studentsDir;
let configFile;
let globalCfg;
let activeKey;
let db;

function clone(value) {
    return JSON.parse(JSON.stringify(value));
}

function merge(target, source) {
    for (const [key, value] of Object.entries(source || {})) {
        if (value && typeof value === "object" && !Array.isArray(value)) {
            target[key] = merge(target[key] || {}, value);
        } else {
            target[key] = value;
        }
    }
    return target;
}

function writeFile(file, data) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const temp = file + ".tmp";
    fs.writeFileSync(temp, JSON.stringify(data, null, 2), "utf8");
    fs.renameSync(temp, file);
}

function studentFile() {
    return path.join(studentsDir, activeKey, "data.json");
}

function saveStudent() {
    writeFile(studentFile(), db);
}

function loadStudent(key) {
    activeKey = key;

    const defaults = {
        student: { ...DEFAULT_STUDENT },
        mail: { service: "gmail", host: "", port: 465, secure: true, user: "", pass: "" },
        portal: { username: "", loggedIn: false, loginAt: 0, lastSync: 0 }
    };

    for (const collection of COLLECTIONS) defaults[collection] = [];

    try {
        const saved = JSON.parse(fs.readFileSync(studentFile(), "utf8"));
        db = merge(defaults, saved);
    } catch {
        db = defaults;
        saveStudent();
    }
}

function init(userDataDir) {
    dataDir = userDataDir;
    studentsDir = path.join(dataDir, "students");
    configFile = path.join(dataDir, "app-config.json");

    fs.mkdirSync(studentsDir, { recursive: true });

    try {
        const saved = JSON.parse(fs.readFileSync(configFile, "utf8"));
        globalCfg = merge(clone(DEFAULT_GLOBAL), saved);
    } catch {
        globalCfg = clone(DEFAULT_GLOBAL);
        writeFile(configFile, globalCfg);
    }

    activeKey = globalCfg.activeKey || "default";
    loadStudent(activeKey);
    return db;
}

function ensureInit() {
    if (!db) throw new Error("Store chưa init.");
}

function all(collection) {
    ensureInit();
    if (!COLLECTIONS.includes(collection)) throw new Error("Collection không hợp lệ.");
    return clone(db[collection]);
}

function get(collection, id) {
    return all(collection).find(item => item.id === id) || null;
}

function getSettings() {
    ensureInit();
    return clone({
        student: db.student,
        mail: db.mail,
        portal: db.portal,
        ...globalCfg.settings,
        _activeKey: activeKey
    });
}

function setSettings(patch = {}) {
    ensureInit();

    for (const key of ["ai", "ui"]) {
        if (patch[key]) {
            globalCfg.settings[key] = merge(globalCfg.settings[key], patch[key]);
        }
    }

    for (const key of ["student", "mail", "portal"]) {
        if (patch[key]) db[key] = merge(db[key], patch[key]);
    }

    writeFile(configFile, globalCfg);
    saveStudent();

    return getSettings();
}

module.exports = {
    init,
    all,
    get,
    getSettings,
    setSettings
};