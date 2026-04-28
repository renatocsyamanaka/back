const router = require('express').Router();
const auth = require('../middleware/auth');
const requirePermission = require('../middleware/requirePermission');
const ctrl = require('../controllers/activityLogController');

router.get('/', auth(), requirePermission('ACTIVITY_LOGS_VIEW'), ctrl.list);
router.get('/:id', auth(), requirePermission('ACTIVITY_LOGS_VIEW'), ctrl.getById);
router.post('/', auth(), requirePermission('ACTIVITY_LOGS_VIEW'), ctrl.createManual);

module.exports = router;
