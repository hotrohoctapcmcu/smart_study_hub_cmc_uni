"use strict";

// Load only the provider requested by the caller.
const modules = {};
for (const name of ["IU", "EDUX", "OUTLOOK"]) {
    Object.defineProperty(modules, name, {
        enumerable: true,
        get: () => require(`./${name}`),
    });
}

module.exports = Object.freeze(modules);
