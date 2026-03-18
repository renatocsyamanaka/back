// src/middleware/rbac.js
const { forbidden } = require('../utils/responses');

function normalizeSectors(value) {
  if (Array.isArray(value)) {
    return [...new Set(value.map((s) => String(s).trim().toUpperCase()).filter(Boolean))];
  }

  if (typeof value === 'string' && value.trim()) {
    return [...new Set(
      value
        .split(',')
        .map((s) => String(s).trim().toUpperCase())
        .filter(Boolean)
    )];
  }

  return [];
}

function hasRequiredSector(userSectors, allowedSectors) {
  if (!allowedSectors.length) return true;
  return allowedSectors.some((sector) => userSectors.includes(sector));
}

/**
 * Modos de uso:
 *
 * requireLevel(3)
 * -> exige nível mínimo 3
 *
 * requireLevel(3, ['LOGISTICA'])
 * -> exige nível mínimo 3 e setor LOGISTICA
 *
 * requireLevel(null, ['OPERACOES'])
 * -> exige apenas setor OPERACOES
 *
 * requireLevel([2,3,4], ['SISTEMAS'])
 * -> exige nível exato 2, 3 ou 4 e setor SISTEMAS
 */
module.exports = function requireLevel(levelOrLevels, sectors = []) {
  return (req, res, next) => {
    const lvl = req.user?.role?.level ?? req.user?.roleLevel ?? 0;
    const userSectors = normalizeSectors(req.user?.sectors);

    const allowedSectors = normalizeSectors(sectors);

    let levelAllowed = true;

    if (Array.isArray(levelOrLevels)) {
      levelAllowed = levelOrLevels.includes(lvl);
    } else if (typeof levelOrLevels === 'number') {
      levelAllowed = lvl >= levelOrLevels;
    } else if (levelOrLevels == null) {
      levelAllowed = true;
    } else {
      levelAllowed = false;
    }

    if (!levelAllowed) {
      return forbidden(res, 'Permissão insuficiente por nível');
    }

    if (!hasRequiredSector(userSectors, allowedSectors)) {
      return forbidden(res, 'Permissão insuficiente por setor');
    }

    return next();
  };
};