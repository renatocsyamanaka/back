const jwt = require('jsonwebtoken');
const { User, Role, Location } = require('../models'); // ⬅ inclui Location
const { ok, bad } = require('../utils/responses');
require('dotenv').config();

module.exports = {
  // POST /api/auth/login
  async login(req, res) {
    const { email, password } = req.body;
    if (!email || !password) return bad(res, 'E-mail e senha são obrigatórios');

    const user = await User.findOne({
      where: { email },
      include: [{ model: Role, as: 'role' }],
    });

    if (!user || !(await user.checkPassword(password))) {
      return bad(res, 'Credenciais inválidas');
    }

    const token = jwt.sign(
      {
        id: user.id,
        roleName: user.role?.name || 'Colaborador',
        roleLevel: user.role?.level || 1,
      },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES || '7d' }
    );

    return ok(res, { token });
  },

  // GET /api/auth/me
  async me(req, res) {
    const me = await User.findByPk(req.user.id, {
      attributes: { exclude: ['password_hash'] },
      include: [
        { model: Role, as: 'role' },
        { model: User, as: 'manager', attributes: ['id', 'name'] },
        { model: Location, as: 'location' },
      ],
    });
    return ok(res, me);
  },
};
