// src/middleware/auth.js
const jwt = require('jsonwebtoken');
const { User, Role } = require('../models');
const { forbidden } = require('../utils/responses');

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

      req.user = user; // ✅ aqui nasce o req.user
      return next();
    } catch (err) {
      return forbidden(res, 'Sessão expirada / token inválido');
    }
  };
};
