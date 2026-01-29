const router = require('express').Router();
const auth = require('../middleware/auth');
const ctrl = require('../controllers/authController');

// login
router.post('/login', ctrl.login);

// dados do usuário logado
router.get('/me', auth(), ctrl.me);

module.exports = router;
