const jwt = require('jsonwebtoken');
const { User, Role } = require('../models');
const { forbidden } = require('../utils/responses');

function normalizeArray(value, fallback = []) {
  if (Array.isArray(value) && value.length > 0) {
    return [...new Set(value.map((s) => String(s).trim().toUpperCase()).filter(Boolean))];
  }

  if (typeof value === 'string' && value.trim()) {
    return [...new Set(
      value.split(',').map((s) => String(s).trim().toUpperCase()).filter(Boolean)
    )];
  }

  return fallback;
}

module.exports = function auth() {
  return async (req, res, next) => {
    try {
      const header = req.headers.authorization || '';
      const [, token] = header.split(' ');

      if (!token) return forbidden(res, 'Não autenticado');

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      if (!decoded?.id) return forbidden(res, 'Token inválido');

      const user = await User.findByPk(decoded.id, {
        attributes: { exclude: ['password_hash'] },
        include: [{ model: Role, as: 'role' }],
      });

      if (!user) return forbidden(res, 'Usuário não encontrado');
      if (user.isActive === false) return forbidden(res, 'Usuário inativo');

      const plainUser = user.toJSON();
      plainUser.sectors = normalizeArray(plainUser.sectors, ['OPERACOES']);
      plainUser.permissions = normalizeArray(plainUser.permissions, []);

      req.user = plainUser;
      return next();
    } catch (err) {
      return forbidden(res, 'Sessão expirada / token inválido');
    }
  };
};