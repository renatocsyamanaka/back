const router = require('express').Router();
const auth = require('../middleware/auth');
const ctrl = require('../controllers/geocodeController');

// forward geocoding
router.get('/', auth(), ctrl.search);

// suggest (autocomplete)
router.get('/suggest', auth(), ctrl.suggest);

// reverse geocoding
router.get('/suggest', ctrl.suggest);

module.exports = router;
