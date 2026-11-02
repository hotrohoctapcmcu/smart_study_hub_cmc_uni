"use strict";

// Preserve the original IU API for existing consumers.
const iu = require("./modules/IU");

Object.defineProperties(iu, {
    modules: { enumerable: true, get: () => require("./modules") },
    createPortalWorkflow: {
        enumerable: true,
        value: (adapters) => require("./shared/portal-workflow").createPortalWorkflow(adapters),
    },
    loginAll: {
        enumerable: true,
        value: (options) => require("./shared/portal-workflow").loginAll(options),
    },
});

module.exports = iu;
