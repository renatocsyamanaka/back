const router = require('express').Router();
const auth = require('../middleware/auth');
const requireLevel = require('../middleware/rbac');

const controller = require('../controllers/filesController');

router.get('/', auth(), requireLevel(2), controller.listAll);

router.post('/delete', auth(), requireLevel(3), controller.deleteFile);

module.exports = router;