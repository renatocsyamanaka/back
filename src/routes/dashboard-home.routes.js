const router = require('express').Router();
const auth = require('../middleware/auth');
const ctrl = require('../controllers/dashboardHomeController');

router.use(auth());

router.get('/', ctrl.getHome);

module.exports = router;