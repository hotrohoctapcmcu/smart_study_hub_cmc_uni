"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");

function jsFiles(directory) {
    return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
        const target = path.join(directory, entry.name);
        return entry.isDirectory() ? jsFiles(target) : entry.name.endsWith(".js") ? [target] : [];
    });
}

for (const provider of ["IU", "EDUX", "OUTLOOK"]) {
    test(`${provider}: registry loads the provider and all internal modules`, () => {
        const directory = path.join(root, "modules", provider);
        assert.equal(require(path.join(root, "modules"))[provider], require(directory));
        for (const target of jsFiles(directory)) {
            assert.doesNotThrow(() => require(target), path.relative(root, target));
        }
    });
}

test("adjacent resource files remain available after relocation", () => {
    assert.ok(fs.existsSync(path.join(root, "modules/IU/payload/endpoint_map.txt")));
    assert.ok(Object.keys(require(path.join(root, "modules/IU")).lietKeEndpoint()).length > 0);
});

test("root keeps IU compatibility and exposes the lazy module registry", () => {
    const entry = require(root);
    const modules = require(path.join(root, "modules"));
    assert.equal(entry, modules.IU);
    assert.equal(entry.modules, modules);
    assert.equal(typeof entry.loginIU, "function");
    assert.equal(typeof entry.loginAll, "function");
    for (const provider of ["IU", "EDUX", "OUTLOOK"]) {
        assert.equal(fs.existsSync(path.join(root, provider)), false);
    }
});
