const router = require('express').Router();
const auth = require('../middleware/auth');
const requireLevel = require('../middleware/rbac');
const ctrl = require('../controllers/taskController');

/**
 * @swagger
 * tags:
 *   name: Tasks
 *   description: Demandas (Planner)
 */

// Criar
router.post('/', auth(), requireLevel(2), ctrl.create);

// Listar com filtros
router.get('/', auth(), ctrl.list);

// Confirmar recebimento
router.patch('/:id/ack', auth(), ctrl.ack);

// Atualizar status
router.patch('/:id/status', auth(), ctrl.setStatus);

// ===== NOVAS ROTAS =====

// Lista de solicitantes (quem criou tarefas) com contagem
router.get('/requesters', auth(), ctrl.listRequesters);

// Dados para o mapa (filtrável por solicitante)
router.get('/map', auth(), ctrl.listForMap);

module.exports = router;
