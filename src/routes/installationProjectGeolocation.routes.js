const router = require('express').Router();
const controller = require('../controllers/installationProjectGeolocationController');

// GET → auditar geolocalização dos projetos
router.get('/audit', controller.audit);

module.exports = router;