// routes/overtimeRoutes.js
const router = require('express').Router();
const auth = require('../middleware/auth');
const requireLevel = require('../middleware/rbac');
const ctrl = require('../controllers/overtimeController');

/**
 * @swagger
 * tags:
 *   name: Overtime
 *   description: Banco de Horas por colaborador
 */

// listar banco do usuário
router.get('/:userId', auth(), ctrl.list);

// ✅ criar ajuste (Coordenador+)
router.post('/adjust', auth(), requireLevel(3), ctrl.adjust);

// ✅ editar ajuste (Coordenador+)
router.put('/:id', auth(), requireLevel(3), ctrl.updateEntry);

// ✅ excluir ajuste (Coordenador+)
router.delete('/:id', auth(), requireLevel(3), ctrl.deleteEntry);

module.exports = router;
