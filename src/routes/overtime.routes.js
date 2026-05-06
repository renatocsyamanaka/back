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
/**
 * @swagger
 * /api/overtime/{userId}:
 *   get:
 *     summary: Consulta registros
 *     tags: [Banco de Horas]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Identificador userId
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
router.get('/:userId', auth(), ctrl.list);

// ✅ criar ajuste (Coordenador+)
/**
 * @swagger
 * /api/overtime/adjust:
 *   post:
 *     summary: Cria ou executa ação
 *     tags: [Banco de Horas]
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
router.post('/adjust', auth(), requireLevel(3), ctrl.adjust);

// ✅ editar ajuste (Coordenador+)
/**
 * @swagger
 * /api/overtime/{id}:
 *   put:
 *     summary: Atualiza registro
 *     tags: [Banco de Horas]
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
router.put('/:id', auth(), requireLevel(3), ctrl.updateEntry);

// ✅ excluir ajuste (Coordenador+)
/**
 * @swagger
 * /api/overtime/{id}:
 *   delete:
 *     summary: Remove registro
 *     tags: [Banco de Horas]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Identificador id
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
router.delete('/:id', auth(), requireLevel(3), ctrl.deleteEntry);

module.exports = router;
