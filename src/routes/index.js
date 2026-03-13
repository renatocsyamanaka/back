// src/routes/index.js
const express = require('express');
const router = express.Router();

function pickRouter(mod) {
  // Express Router é uma função (req,res,next)
  if (typeof mod === 'function') return mod;
  // Suporte a ESM: export default router
  if (mod && typeof mod.default === 'function') return mod.default;
  return null;
}

function mount(path, file) {
  let mod;
  try {
    mod = require(file);
  } catch (err) {
    console.error(`[routes] Falha ao importar ${file}:`, err.message);
    throw err;
  }

  const r = pickRouter(mod);
  if (!r) {
    console.error(
      `[routes] ${file} não exporta um Router válido. Corrija o arquivo para fazer: module.exports = router`
    );
    throw new TypeError(`Arquivo ${file} não exporta um Router`);
  }

  router.use(path, r);
  // opcional: log
  // console.log(`[routes] mounted ${path} -> ${file}`);
}

// Monte apenas o que existir no seu projeto:
mount('/auth',        './auth.routes');
mount('/users',       './users.routes');
mount('/org',         './org.routes');
mount('/locations',   './locations.routes');
mount('/clients',     './clients.routes');
mount('/techtypes',   './techtypes.routes');
mount('/tech-types',  './techtypes.routes'); 
mount('/needs',       './needs.routes');
mount('/part-requests', './partRequestRoutes');
mount('/geocode',       './geocode.routes');
mount('/assignments', './assignments.routes');
mount('/overtime',    './overtime.routes');
mount('/timeoff',     './timeoff.routes');
mount('/geocode',     './geocode.routes');
mount('/tasks',       './tasks.routes');
mount('/news',       './news.routes');
mount('/installation-projects',       './installationProjects.routes');
mount('/parts', './partCatalogRoutes');

module.exports = router;
