const { User, Role } = require('../models');
const { ok } = require('../utils/responses');

function normalizeSectors(value) {
  if (!value) return [];

  if (Array.isArray(value)) {
    return [...new Set(value.map((s) => String(s || '').trim().toUpperCase()).filter(Boolean))];
  }

  if (typeof value === 'string') {
    return [...new Set(value.split(',').map((s) => String(s || '').trim().toUpperCase()).filter(Boolean))];
  }

  return [];
}

function buildTreeFromFlat(list) {
  const byId = new Map();
  const childrenByManager = new Map();

  for (const u of list) {
    byId.set(u.id, {
      id: u.id,
      name: u.name,
      role: u.role?.name || null,
      roleLevel: u.role?.level || 0,
      managerId: u.managerId ?? null,
      avatarUrl: u.avatarUrl || null,
      sectors: normalizeSectors(u.sectors),
      children: [],
    });
  }

  // agrupa filhos por managerId
  for (const u of list) {
    if (!childrenByManager.has(u.managerId ?? null)) {
      childrenByManager.set(u.managerId ?? null, []);
    }
    childrenByManager.get(u.managerId ?? null).push(u.id);
  }

  // define raízes reais
  let rootIds = list
    .filter((u) => !u.managerId || u.managerId === u.id || !byId.has(u.managerId))
    .map((u) => u.id);

  // fallback: se ninguém estiver sem gestor, pega maior nível
  if (rootIds.length === 0) {
    const maxLevel = Math.max(...list.map((u) => u.role?.level || 0));
    rootIds = list.filter((u) => (u.role?.level || 0) === maxLevel).map((u) => u.id);
  }

  const globallyVisited = new Set();

  function mountNode(nodeId, path = new Set()) {
    const node = byId.get(nodeId);
    if (!node) return null;

    // se detectou ciclo, corta esse ramo
    if (path.has(nodeId)) {
      console.warn('CICLO CORTADO NO ORG:', [...path, nodeId]);
      return null;
    }

    const nextPath = new Set(path);
    nextPath.add(nodeId);

    const childIds = childrenByManager.get(nodeId) || [];
    const mountedChildren = [];

    for (const childId of childIds) {
      if (childId === nodeId) {
        console.warn('AUTO GERENCIAMENTO CORTADO:', nodeId);
        continue;
      }

      const childNode = mountNode(childId, nextPath);
      if (childNode) mountedChildren.push(childNode);
    }

    return {
      ...node,
      children: mountedChildren.sort(
        (a, b) =>
          (b.roleLevel ?? 0) - (a.roleLevel ?? 0) ||
          String(a.name || '').localeCompare(String(b.name || ''))
      ),
    };
  }

  const roots = [];
  for (const rootId of rootIds) {
    const mounted = mountNode(rootId);
    if (mounted) {
      roots.push(mounted);
      globallyVisited.add(rootId);
    }
  }

  // adiciona nós não alcançados como raízes órfãs, sem destruir a hierarquia deles
  for (const u of list) {
    const alreadyInRoots = roots.some((r) => r.id === u.id);
    if (alreadyInRoots) continue;

    const appearsAsChild = list.some((x) => x.managerId === u.id);
    const mounted = mountNode(u.id);

    if (mounted && !roots.find((r) => r.id === mounted.id)) {
      roots.push(mounted);
    }
  }

  roots.sort(
    (a, b) =>
      (b.roleLevel ?? 0) - (a.roleLevel ?? 0) ||
      String(a.name || '').localeCompare(String(b.name || ''))
  );

  return roots;
}

module.exports = {
  async tree(req, res) {
    try {
      const users = await User.findAll({
        attributes: ['id', 'name', 'managerId', 'avatarUrl', 'sectors', 'isActive'],
        where: { isActive: true },
        include: [
          {
            model: Role,
            as: 'role',
            attributes: ['name', 'level'],
            required: false,
          },
        ],
        order: [['name', 'ASC']],
      });

      const plain = users.map((u) => ({
        id: u.id,
        name: u.name,
        managerId: u.managerId,
        avatarUrl: u.avatarUrl,
        sectors: u.sectors,
        isActive: u.isActive,
        role: u.role
          ? {
              name: u.role.name,
              level: u.role.level,
            }
          : null,
      }));

      const tree = buildTreeFromFlat(plain);

      return ok(res, tree);
    } catch (err) {
      return res.status(500).json({
        error: 'Erro ao montar organograma',
        details: err.message,
      });
    }
  },
};