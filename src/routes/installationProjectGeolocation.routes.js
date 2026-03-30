const router = require('express').Router();
const controller = require('../controllers/installationProjectGeolocationController');

// GET → ver quem está sem coordenada
router.get('/audit', controller.audit);

// POST → preencher automaticamente
router.post('/fill-missing', controller.fillMissing);

module.exports = router;