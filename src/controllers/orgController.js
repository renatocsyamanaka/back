// src/controllers/orgController.js
const { User, Role } = require('../models');
const { ok } = require('../utils/responses');

function buildTreeFromFlat(list) {
  const map = new Map();
  const roots = [];

  // cria nós básicos
  for (const u of list) {
    map.set(u.id, {
      id: u.id,
      name: u.name,
      role: u.role ? u.role.name : null,
      roleLevel: u.role ? u.role.level : null,
      managerId: u.managerId ?? null,
      avatarUrl: u.avatarUrl || null,
      children: [],
    });
  }

  // conecta filhos aos gestores
  for (const u of list) {
    const node = map.get(u.id);
    if (u.managerId && map.has(u.managerId)) {
      map.get(u.managerId).children.push(node);
    } else {
      // se não tem gestor (ou gestor não encontrado), vira raiz
      roots.push(node);
    }
  }

  // ordena por nível/cargo e nome (opcional)
  const sortRec = (nodes) => {
    nodes.sort((a, b) =>
      (b.roleLevel ?? 0) - (a.roleLevel ?? 0) || a.name.localeCompare(b.name)
    );
    nodes.forEach(n => sortRec(n.children));
  };
  sortRec(roots);

  return roots;
}

module.exports = {
  async tree(req, res) {
    try {
      const users = await User.findAll({
        attributes: ['id', 'name', 'managerId', 'avatarUrl'],
        where: { isActive: true },
        include: [
          { model: Role, as: 'role', attributes: ['name', 'level'] },
        ],
        order: [['name', 'ASC']],
      });

      // transforma para objetos simples (evita getters do Sequelize)
      const plain = users.map(u => ({
        id: u.id,
        name: u.name,
        managerId: u.managerId,
        avatarUrl: u.avatarUrl,
        role: u.role ? { name: u.role.name, level: u.role.level } : null,
      }));

      const tree = buildTreeFromFlat(plain);
      return ok(res, tree);
    } catch (err) {
      console.error(err);
      return res
        .status(500)
        .json({ error: 'Erro ao montar organograma', details: err.message });
    }
  },
};
