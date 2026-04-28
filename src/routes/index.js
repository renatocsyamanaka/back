const express = require('express');
const router = express.Router();

function pickRouter(mod) {
  if (typeof mod === 'function') return mod;
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
    console.error(`[routes] ${file} não exporta um Router válido.`);
    throw new TypeError(`Arquivo ${file} não exporta um Router`);
  }

  router.use(path, r);
}

mount('/auth', './auth.routes');
mount('/users', './users.routes');
mount('/org', './org.routes');
mount('/locations', './locations.routes');
mount('/clients', './clients.routes');
mount('/techtypes', './techtypes.routes');
mount('/tech-types', './techtypes.routes');
mount('/needs', './needs.routes');
mount('/part-requests', './part-requests.routes');
mount('/geocode', './geocode.routes');
mount('/assignments', './assignments.routes');
mount('/overtime', './overtime.routes');
mount('/timeoff', './timeoff.routes');
mount('/tasks', './tasks.routes');
mount('/news', './news.routes');

/* IMPORTANTE: dashboard */
mount('/dashboard-home', './dashboard-home.routes');
mount('/dashboard-banners', './dashboard-banners.routes');
mount('/system-updates', './system-updates.routes');

/* IMPORTANTE: dashboard antes da rota genérica */
mount('/installation-projects/dashboard', './installationProjectsDashboard.routes');
mount('/installation-projects', './installationProjects.routes');
mount('/installation-projects/geolocation', './installationProjectGeolocation.routes');
mount('/files', './files.routes');
mount('/parts', './part-catalog.routes');
mount('/user-registration-requests', './userRegistrationRequest.routes');
mount('/delivery-reports', './delivery-reports.routes');
mount('/demands', './demands.routes');
mount('/dashboard-activities', './dashboard-activities.routes');
mount('/need-homologation', './need-homologation.routes');
mount('/need-ata', './need-ata.routes');
mount('/whatsapp', './whatsapp.routes');

module.exports = router;