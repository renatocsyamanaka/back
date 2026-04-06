const router = require('express').Router();
const ctrl = require('../controllers/installationProjectDashboardController');

router.get('/overview', (req, res, next) => {
  next();
}, ctrl.overview);

router.get('/summary', ctrl.summary);
router.get('/productivity', ctrl.productivity);
router.get('/by-client', ctrl.byClient);
router.get('/by-status', ctrl.byStatus);
router.get('/success-rate', ctrl.successRate);
router.get('/by-coordinator', ctrl.byCoordinator);
router.get('/by-technician', ctrl.byTechnician);
router.get('/by-region', ctrl.byRegion);
router.get('/ending-soon', ctrl.endingSoon);
router.get('/by-product', ctrl.byProduct);
router.get('/map', ctrl.map);
router.get('/delayed-projects', ctrl.delayedProjects);


module.exports = router;