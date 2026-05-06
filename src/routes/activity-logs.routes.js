const router = require('express').Router();
const auth = require('../middleware/auth');
const requirePermission = require('../middleware/requirePermission');
const ctrl = require('../controllers/activityLogController');

/**
 * @swagger
 * /api/activity-logs:
 *   get:
 *     summary: Consulta registros
 *     tags: [Logs de Auditoria]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Operação realizada com sucesso
 */
router.get('/', auth(), requirePermission('ACTIVITY_LOGS_VIEW'), ctrl.list);

/**
 * @swagger
 * /api/activity-logs/export:
 *   get:
 *     summary: Exportar logs de atividades em Excel
 *     description: "Exporta os logs de atividades com base nos filtros informados. Limite máximo de 30 dias por exportação."
 *     tags: [Logs de Auditoria]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: q
 *         schema:
 *           type: string
 *         description: "Busca por usuário, ação ou descrição"
 *       - in: query
 *         name: action
 *         schema:
 *           type: string
 *         description: "Filtrar por ação. Exemplo: PROGRESSO_CRIADO"
 *       - in: query
 *         name: dateFrom
 *         schema:
 *           type: string
 *           format: date
 *         required: true
 *         description: "Data inicial no formato YYYY-MM-DD"
 *       - in: query
 *         name: dateTo
 *         schema:
 *           type: string
 *           format: date
 *         required: true
 *         description: "Data final no formato YYYY-MM-DD"
 *     responses:
 *       200:
 *         description: "Arquivo Excel gerado com sucesso"
 *         content:
 *           application/vnd.openxmlformats-officedocument.spreadsheetml.sheet:
 *             schema:
 *               type: string
 *               format: binary
 *       400:
 *         description: "Erro de validação. Exemplo: período maior que 30 dias."
 *       401:
 *         description: "Não autenticado"
 *       403:
 *         description: "Sem permissão"
 *       500:
 *         description: "Erro interno"
 */
router.get('/export', auth(), requirePermission('ACTIVITY_LOGS_VIEW'), ctrl.exportExcel);

/**
 * @swagger
 * /api/activity-logs:
 *   post:
 *     summary: Cria ou executa ação
 *     tags: [Logs de Auditoria]
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
 */
router.post('/', auth(), requirePermission('ACTIVITY_LOGS_VIEW'), ctrl.createManual);

/**
 * @swagger
 * /api/activity-logs/{id}:
 *   get:
 *     summary: Consulta registro por ID
 *     tags: [Logs de Auditoria]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: "Identificador do log"
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
router.get('/:id', auth(), requirePermission('ACTIVITY_LOGS_VIEW'), ctrl.getById);

module.exports = router;