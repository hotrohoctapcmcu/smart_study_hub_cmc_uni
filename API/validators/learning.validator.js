'use strict';

const nonempty = (value, max) => typeof value === 'string' && value.trim().length > 0 && value.length <= max;

module.exports = { nonempty };
