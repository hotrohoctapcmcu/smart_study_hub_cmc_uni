const { API_PREFIX } = require('../config');

exports.health = (req, res) => res.json({ success: true, status: 'online' });
exports.index = (req, res) => res.json({ success: true, status: 'online', endpoints: API_PREFIX });
