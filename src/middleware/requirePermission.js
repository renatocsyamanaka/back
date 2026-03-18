// middleware/requirePermission.js
const { forbidden } = require('../utils/responses');

module.exports = function requirePermission(permission) {
  return (req, res, next) => {
    const user = req.user;
    const level = user?.role?.level || 0;

    // 🔥 FULL ACCESS
    if (level >= 5) return next();

    const has = user?.permissions?.includes(permission);

    if (!has) {
      return forbidden(res, 'Sem permissão');
    }

    return next();
  };
};