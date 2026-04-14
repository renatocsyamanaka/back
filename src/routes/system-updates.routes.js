const router = require('express').Router();
const auth = require('../middleware/auth');
const requireLevel = require('../middleware/rbac');
const ctrl = require('../controllers/systemUpdateController');

router.use(auth());

router.get('/', ctrl.list);
router.get('/:id', ctrl.getById);

router.post('/', requireLevel(2), ctrl.create);
router.patch('/:id', requireLevel(2), ctrl.update);
router.delete('/:id', requireLevel(2), ctrl.remove);
router.post('/:id/restore', requireLevel(2), ctrl.restore);

module.exports = router;