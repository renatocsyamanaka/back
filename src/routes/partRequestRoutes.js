const router = require('express').Router();
const auth = require('../middleware/auth');
const requireLevel = require('../middleware/rbac');

const partRequestController = require('../controllers/partRequestController');
const partRequestItemController = require('../controllers/partRequestItemController');

/**
 * rotas públicas
 */
router.post('/public', partRequestController.create);
router.get('/public/search', partRequestController.publicSearch);

/**
 * rotas internas
 */
router.post('/', auth(), partRequestController.create);
router.get('/', auth(), partRequestController.list);

router.get('/:id', auth(), partRequestController.show);
router.patch('/:id', auth(), requireLevel(2), partRequestController.update);

router.post('/:id/batch-approve', auth(), requireLevel(3), partRequestController.batchApprove);

router.post('/items/:itemId/approve', auth(), requireLevel(3), partRequestItemController.approve);
router.post('/items/:itemId/reject', auth(), requireLevel(3), partRequestItemController.reject);

module.exports = router;