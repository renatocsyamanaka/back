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
/**
 * @swagger
 * /api/tasks:
 *   post:
 *     summary: Cria ou executa ação
 *     tags: [Tarefas]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             additionalProperties: true
 *     responses:
 *       200:
 *         description: Operação realizada com sucesso
 *       201:
 *         description: Registro criado com sucesso
 *       400:
 *         description: Requisição inválida
 *       401:
 *         description: Não autenticado
 *       403:
 *         description: Sem permissão
 *       404:
 *         description: Registro não encontrado
 *       500:
 *         description: Erro interno
 */
router.post('/', auth(), requireLevel(2), ctrl.create);

// Listar com filtros
/**
 * @swagger
 * /api/tasks:
 *   get:
 *     summary: Consulta registros
 *     tags: [Tarefas]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Operação realizada com sucesso
 *       400:
 *         description: Requisição inválida
 *       401:
 *         description: Não autenticado
 *       403:
 *         description: Sem permissão
 *       404:
 *         description: Registro não encontrado
 *       500:
 *         description: Erro interno
 */
router.get('/', auth(), ctrl.list);

// Confirmar recebimento
/**
 * @swagger
 * /api/tasks/{id}/ack:
 *   patch:
 *     summary: Atualiza parcialmente registro
 *     tags: [Tarefas]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Identificador id
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             additionalProperties: true
 *     responses:
 *       200:
 *         description: Operação realizada com sucesso
 *       400:
 *         description: Requisição inválida
 *       401:
 *         description: Não autenticado
 *       403:
 *         description: Sem permissão
 *       404:
 *         description: Registro não encontrado
 *       500:
 *         description: Erro interno
 */
router.patch('/:id/ack', auth(), ctrl.ack);

// Atualizar status
/**
 * @swagger
 * /api/tasks/{id}/status:
 *   patch:
 *     summary: Atualiza parcialmente registro
 *     tags: [Tarefas]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Identificador id
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             additionalProperties: true
 *     responses:
 *       200:
 *         description: Operação realizada com sucesso
 *       400:
 *         description: Requisição inválida
 *       401:
 *         description: Não autenticado
 *       403:
 *         description: Sem permissão
 *       404:
 *         description: Registro não encontrado
 *       500:
 *         description: Erro interno
 */
router.patch('/:id/status', auth(), ctrl.setStatus);

// ===== NOVAS ROTAS =====

// Lista de solicitantes (quem criou tarefas) com contagem
/**
 * @swagger
 * /api/tasks/requesters:
 *   get:
 *     summary: Consulta registros
 *     tags: [Tarefas]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Operação realizada com sucesso
 *       400:
 *         description: Requisição inválida
 *       401:
 *         description: Não autenticado
 *       403:
 *         description: Sem permissão
 *       404:
 *         description: Registro não encontrado
 *       500:
 *         description: Erro interno
 */
router.get('/requesters', auth(), ctrl.listRequesters);

// Dados para o mapa (filtrável por solicitante)
/**
 * @swagger
 * /api/tasks/map:
 *   get:
 *     summary: Consulta registros
 *     tags: [Tarefas]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Operação realizada com sucesso
 *       400:
 *         description: Requisição inválida
 *       401:
 *         description: Não autenticado
 *       403:
 *         description: Sem permissão
 *       404:
 *         description: Registro não encontrado
 *       500:
 *         description: Erro interno
 */
router.get('/map', auth(), ctrl.listForMap);

module.exports = router;
