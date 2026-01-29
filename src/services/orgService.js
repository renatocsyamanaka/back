const { User } = require('../models');

/**
 * Retorna todos os IDs de usuários abaixo de rootId (diretos e indiretos).
 */
async function getDescendantIds(rootId) {
  const rows = await User.findAll({ attributes: ['id', 'managerId'] });

  // índice managerId -> [ids]
  const childrenByManager = new Map();
  for (const r of rows) {
    const key = r.managerId || 0;
    if (!childrenByManager.has(key)) childrenByManager.set(key, []);
    childrenByManager.get(key).push(r.id);
  }

  const result = new Set();
  const stack = [...(childrenByManager.get(rootId) || [])];

  while (stack.length) {
    const id = stack.pop();
    if (result.has(id)) continue;
    result.add(id);
    const kids = childrenByManager.get(id) || [];
    for (const k of kids) stack.push(k);
  }

  return Array.from(result);
}

module.exports = { getDescendantIds };
