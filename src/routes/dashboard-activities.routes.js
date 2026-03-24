const express = require('express');
const router = express.Router();

const auth = require('../middleware/auth');
const requireLevel = require('../middleware/rbac');
const controller = require('../controllers/dashboardActivityController');

router.use(auth());

/**
 * @swagger
 * tags:
 *   - name: Dashboard Activities
 *     description: Responsabilidades de atualização de dashboards e sistemas
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     DashboardActivity:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *           example: 1
 *         workspace:
 *           type: string
 *           example: Operações
 *         nome:
 *           type: string
 *           example: Estoque Prestadores
 *         periodicidade:
 *           type: string
 *           enum: [DIARIO, SEMANAL, MENSAL]
 *           example: DIARIO
 *         diaAplicacao:
 *           type: string
 *           nullable: true
 *           example: 10
 *         responsavelId:
 *           type: integer
 *           nullable: true
 *           example: 12
 *         urgencia:
 *           type: string
 *           enum: [BAIXA, MEDIA, ALTA]
 *           nullable: true
 *           example: ALTA
 *         solicitante:
 *           type: string
 *           nullable: true
 *           example: Rosalin
 *         observacoes:
 *           type: string
 *           nullable: true
 *           example: Atualizar antes da reunião diária
 *         createdById:
 *           type: integer
 *           nullable: true
 *           example: 3
 *         updatedById:
 *           type: integer
 *           nullable: true
 *           example: 3
 *         deletedById:
 *           type: integer
 *           nullable: true
 *           example: 5
 *         deletedAt:
 *           type: string
 *           format: date-time
 *           nullable: true
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 *         responsavel:
 *           type: object
 *           nullable: true
 *           properties:
 *             id:
 *               type: integer
 *               example: 12
 *             name:
 *               type: string
 *               example: Alex Alixandre
 *             email:
 *               type: string
 *               example: alex.alixandre@empresa.com
 *         createdBy:
 *           type: object
 *           nullable: true
 *           properties:
 *             id:
 *               type: integer
 *               example: 3
 *             name:
 *               type: string
 *               example: Renato Yamanaka
 *             email:
 *               type: string
 *               example: renato.yamanaka@empresa.com
 *         updatedBy:
 *           type: object
 *           nullable: true
 *           properties:
 *             id:
 *               type: integer
 *               example: 3
 *             name:
 *               type: string
 *               example: Renato Yamanaka
 *             email:
 *               type: string
 *               example: renato.yamanaka@empresa.com
 *         deletedBy:
 *           type: object
 *           nullable: true
 *           properties:
 *             id:
 *               type: integer
 *               example: 5
 *             name:
 *               type: string
 *               example: Administrador
 *             email:
 *               type: string
 *               example: admin@empresa.com
 *
 *     DashboardActivityInput:
 *       type: object
 *       required:
 *         - workspace
 *         - nome
 *         - periodicidade
 *       properties:
 *         workspace:
 *           type: string
 *           example: Operações
 *         nome:
 *           type: string
 *           example: Produtividade Clientes
 *         periodicidade:
 *           type: string
 *           enum: [DIARIO, SEMANAL, MENSAL]
 *           example: DIARIO
 *         diaAplicacao:
 *           type: string
 *           nullable: true
 *           example: 10
 *         responsavelId:
 *           type: integer
 *           nullable: true
 *           example: 12
 *         urgencia:
 *           type: string
 *           enum: [BAIXA, MEDIA, ALTA]
 *           nullable: true
 *           example: ALTA
 *         solicitante:
 *           type: string
 *           nullable: true
 *           example: Operações
 *         observacoes:
 *           type: string
 *           nullable: true
 *           example: Conferir todos os dias antes das 09:00
 *
 *     DashboardActivityMessageResponse:
 *       type: object
 *       properties:
 *         message:
 *           type: string
 *           example: Responsabilidade excluída com sucesso.
 */

/**
 * @swagger
 * /api/dashboard-activities:
 *   get:
 *     summary: Lista as responsabilidades de atualização
 *     tags: [Dashboard Activities]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Busca por workspace, nome, solicitante ou observações
 *         example: estoque
 *       - in: query
 *         name: workspace
 *         schema:
 *           type: string
 *         description: Filtra por workspace
 *         example: Operações
 *       - in: query
 *         name: periodicidade
 *         schema:
 *           type: string
 *           enum: [DIARIO, SEMANAL, MENSAL]
 *         description: Filtra por periodicidade
 *       - in: query
 *         name: urgencia
 *         schema:
 *           type: string
 *           enum: [BAIXA, MEDIA, ALTA]
 *         description: Filtra por urgência
 *       - in: query
 *         name: responsavelId
 *         schema:
 *           type: integer
 *         description: Filtra por responsável
 *         example: 12
 *       - in: query
 *         name: includeDeleted
 *         schema:
 *           type: string
 *           enum: ["true", "false"]
 *         description: Informar "true" para incluir registros excluídos logicamente
 *         example: "false"
 *     responses:
 *       200:
 *         description: Lista retornada com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/DashboardActivity'
 *       500:
 *         description: Erro interno ao listar responsabilidades
 */
router.get('/', controller.list);

/**
 * @swagger
 * /api/dashboard-activities/{id}:
 *   get:
 *     summary: Busca uma responsabilidade por ID
 *     tags: [Dashboard Activities]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID da responsabilidade
 *         example: 1
 *     responses:
 *       200:
 *         description: Responsabilidade encontrada com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/DashboardActivity'
 *       404:
 *         description: Responsabilidade não encontrada
 *       500:
 *         description: Erro interno ao buscar responsabilidade
 */
router.get('/:id', controller.getById);

/**
 * @swagger
 * /api/dashboard-activities:
 *   post:
 *     summary: Cria uma nova responsabilidade de atualização
 *     tags: [Dashboard Activities]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/DashboardActivityInput'
 *     responses:
 *       201:
 *         description: Responsabilidade criada com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/DashboardActivity'
 *       400:
 *         description: Dados inválidos
 *       500:
 *         description: Erro interno ao criar responsabilidade
 */
router.post('/', requireLevel(2), controller.create);

/**
 * @swagger
 * /api/dashboard-activities/{id}:
 *   put:
 *     summary: Atualiza uma responsabilidade existente
 *     tags: [Dashboard Activities]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID da responsabilidade
 *         example: 1
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/DashboardActivityInput'
 *     responses:
 *       200:
 *         description: Responsabilidade atualizada com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/DashboardActivity'
 *       404:
 *         description: Responsabilidade não encontrada
 *       500:
 *         description: Erro interno ao atualizar responsabilidade
 */
router.put('/:id', requireLevel(2), controller.update);

/**
 * @swagger
 * /api/dashboard-activities/{id}:
 *   delete:
 *     summary: Exclui uma responsabilidade logicamente
 *     tags: [Dashboard Activities]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID da responsabilidade
 *         example: 1
 *     responses:
 *       200:
 *         description: Responsabilidade excluída com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/DashboardActivityMessageResponse'
 *       404:
 *         description: Responsabilidade não encontrada
 *       500:
 *         description: Erro interno ao excluir responsabilidade
 */
router.delete('/:id', requireLevel(3), controller.remove);

/**
 * @swagger
 * /api/dashboard-activities/{id}/restore:
 *   patch:
 *     summary: Restaura uma responsabilidade excluída logicamente
 *     tags: [Dashboard Activities]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID da responsabilidade
 *         example: 1
 *     responses:
 *       200:
 *         description: Responsabilidade restaurada com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/DashboardActivityMessageResponse'
 *       404:
 *         description: Responsabilidade não encontrada
 *       500:
 *         description: Erro interno ao restaurar responsabilidade
 */
router.patch('/:id/restore', requireLevel(3), controller.restore);

module.exports = router;