// src/middleware/rbac.js
const { forbidden } = require('../utils/responses');

module.exports = function requireLevel(minLevel) {
  return (req, res, next) => {
    const lvl = req.user?.role?.level ?? req.user?.roleLevel ?? 0;
    if (lvl >= minLevel) return next();
    return forbidden(res, 'Permissão insuficiente');
  };
};
