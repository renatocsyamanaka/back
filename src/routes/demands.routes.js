const express = require('express');
const router = express.Router();

const auth = require('../middleware/auth');
const requireLevel = require('../middleware/rbac');
const controller = require('../controllers/demandController');
const auditAction = require('../middleware/auditAction');

router.use(auth());

/**
 * @swagger
 * tags:
 *   - name: Demands
 *     description: Gestão do planejamento de demandas integrado aos usuários do sistema
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     Demand:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *           example: 1
 *         tipo:
 *           type: string
 *           enum: [PROGRAMACAO, CONCLUIDA, ROTINA, DASHBOARD]
 *           example: PROGRAMACAO
 *         nome:
 *           type: string
 *           example: Ajuste no painel operacional
 *         plataforma:
 *           type: string
 *           nullable: true
 *           example: Power BI
 *         periodicidade:
 *           type: string
 *           nullable: true
 *           example: Semanal
 *         diaAplicacao:
 *           type: string
 *           nullable: true
 *           example: Segunda-feira
 *         urgencia:
 *           type: string
 *           nullable: true
 *           example: alta
 *         solicitante:
 *           type: string
 *           nullable: true
 *           example: Renato Yamanaka
 *         descricao:
 *           type: string
 *           nullable: true
 *           example: Criar novo card com indicadores da operação
 *         observacoes:
 *           type: string
 *           nullable: true
 *           example: Prioridade validada pela gestão
 *         status:
 *           type: string
 *           nullable: true
 *           example: Em andamento
 *         entregaPrevista:
 *           type: string
 *           format: date-time
 *           nullable: true
 *         dataEntrega:
 *           type: string
 *           format: date-time
 *           nullable: true
 *         workspace:
 *           type: string
 *           nullable: true
 *           example: CIA Supply
 *         origemExcelAba:
 *           type: string
 *           nullable: true
 *           example: Programação
 *         responsavelId:
 *           type: integer
 *           nullable: true
 *           example: 12
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
 *               example: Renato Yamanaka
 *             email:
 *               type: string
 *               example: renato.yamanaka@empresa.com
 *
 *     DemandHistory:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *           example: 10
 *         demandId:
 *           type: integer
 *           example: 1
 *         actionType:
 *           type: string
 *           example: UPDATED
 *         fieldName:
 *           type: string
 *           nullable: true
 *           example: status
 *         oldValue:
 *           type: string
 *           nullable: true
 *           example: A Iniciar
 *         newValue:
 *           type: string
 *           nullable: true
 *           example: Em andamento
 *         comments:
 *           type: string
 *           nullable: true
 *           example: Alteração feita após alinhamento
 *         performedByUserId:
 *           type: integer
 *           nullable: true
 *           example: 3
 *         performedByName:
 *           type: string
 *           nullable: true
 *           example: Renato Yamanaka
 *         performedByProfile:
 *           type: string
 *           nullable: true
 *           example: Coordenador
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 *
 *     DemandListResponse:
 *       type: object
 *       properties:
 *         data:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/Demand'
 *         meta:
 *           type: object
 *           properties:
 *             total:
 *               type: integer
 *               example: 87
 *             page:
 *               type: integer
 *               example: 1
 *             limit:
 *               type: integer
 *               example: 20
 *             totalPages:
 *               type: integer
 *               example: 5
 *
 *     DemandSummaryResponse:
 *       type: object
 *       properties:
 *         total:
 *           type: integer
 *           example: 120
 *         programacao:
 *           type: integer
 *           example: 35
 *         concluidas:
 *           type: integer
 *           example: 42
 *         rotina:
 *           type: integer
 *           example: 28
 *         dashboards:
 *           type: integer
 *           example: 15
 */

/**
 * @swagger
 * /api/demands:
 *   get:
 *     summary: Lista demandas com filtros e paginação
 *     tags: [Demands]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           example: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           example: 10
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *           example: painel
 *       - in: query
 *         name: tipo
 *         schema:
 *           type: string
 *           enum: [PROGRAMACAO, CONCLUIDA, ROTINA, DASHBOARD]
 *           example: PROGRAMACAO
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           example: Em andamento
 *       - in: query
 *         name: urgencia
 *         schema:
 *           type: string
 *           example: alta
 *       - in: query
 *         name: responsavelId
 *         schema:
 *           type: integer
 *           example: 12
 *       - in: query
 *         name: includeDeleted
 *         schema:
 *           type: string
 *           example: "true"
 *         description: Informar "true" para incluir registros excluídos logicamente
 *     responses:
 *       200:
 *         description: Lista paginada de demandas
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/DemandListResponse'
 */
router.get('/', controller.list);

/**
 * @swagger
 * /api/demands/summary:
 *   get:
 *     summary: Retorna resumo das demandas para os cards do dashboard
 *     tags: [Demands]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Resumo consolidado das demandas
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/DemandSummaryResponse'
 */
router.get('/summary', controller.summary);

/**
 * @swagger
 * /api/demands/{id}/history:
 *   get:
 *     summary: Busca o histórico de alterações de uma demanda
 *     tags: [Demands]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *           example: 1
 *     responses:
 *       200:
 *         description: Histórico da demanda
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/DemandHistory'
 *       404:
 *         description: Demanda não encontrada
 */
router.get('/:id/history', controller.history);

/**
 * @swagger
 * /api/demands/{id}:
 *   get:
 *     summary: Busca uma demanda por ID
 *     tags: [Demands]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *           example: 1
 *     responses:
 *       200:
 *         description: Demanda encontrada
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Demand'
 *       404:
 *         description: Demanda não encontrada
 */
router.get('/:id', controller.getById);

/**
 * @swagger
 * /api/demands:
 *   post:
 *     summary: Cria uma nova demanda
 *     tags: [Demands]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - tipo
 *               - nome
 *             properties:
 *               tipo:
 *                 type: string
 *                 enum: [PROGRAMACAO, CONCLUIDA, ROTINA, DASHBOARD]
 *                 example: PROGRAMACAO
 *               nome:
 *                 type: string
 *                 example: Ajuste no painel operacional
 *               plataforma:
 *                 type: string
 *                 nullable: true
 *                 example: Power BI
 *               periodicidade:
 *                 type: string
 *                 nullable: true
 *                 example: Semanal
 *               diaAplicacao:
 *                 type: string
 *                 nullable: true
 *                 example: Segunda-feira
 *               urgencia:
 *                 type: string
 *                 nullable: true
 *                 example: alta
 *               solicitante:
 *                 type: string
 *                 nullable: true
 *                 example: Renato Yamanaka
 *               descricao:
 *                 type: string
 *                 nullable: true
 *                 example: Criar um novo indicador para o dashboard
 *               observacoes:
 *                 type: string
 *                 nullable: true
 *                 example: Validado com a liderança
 *               status:
 *                 type: string
 *                 nullable: true
 *                 example: A Iniciar
 *               entregaPrevista:
 *                 type: string
 *                 format: date
 *                 nullable: true
 *               dataEntrega:
 *                 type: string
 *                 format: date
 *                 nullable: true
 *               workspace:
 *                 type: string
 *                 nullable: true
 *                 example: CIA Operações
 *               origemExcelAba:
 *                 type: string
 *                 nullable: true
 *                 example: Programação
 *               responsavelId:
 *                 type: integer
 *                 nullable: true
 *                 example: 12
 *               comments:
 *                 type: string
 *                 nullable: true
 *                 example: Cadastro inicial da demanda
 *     responses:
 *       201:
 *         description: Demanda criada com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Demand'
 *       400:
 *         description: Dados inválidos
 */
router.post('/', requireLevel(2), auditAction({ module: 'DEMANDS', action: 'DEMANDA_CRIADA', description: 'Criou uma demanda', entity: 'Demand' }), controller.create);

/**
 * @swagger
 * /api/demands/{id}:
 *   put:
 *     summary: Atualiza uma demanda existente
 *     tags: [Demands]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *           example: 1
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               tipo:
 *                 type: string
 *                 enum: [PROGRAMACAO, CONCLUIDA, ROTINA, DASHBOARD]
 *                 example: CONCLUIDA
 *               nome:
 *                 type: string
 *                 example: Ajuste no painel operacional
 *               plataforma:
 *                 type: string
 *                 nullable: true
 *               periodicidade:
 *                 type: string
 *                 nullable: true
 *               diaAplicacao:
 *                 type: string
 *                 nullable: true
 *               urgencia:
 *                 type: string
 *                 nullable: true
 *               solicitante:
 *                 type: string
 *                 nullable: true
 *               descricao:
 *                 type: string
 *                 nullable: true
 *               observacoes:
 *                 type: string
 *                 nullable: true
 *               status:
 *                 type: string
 *                 nullable: true
 *               entregaPrevista:
 *                 type: string
 *                 format: date
 *                 nullable: true
 *               dataEntrega:
 *                 type: string
 *                 format: date
 *                 nullable: true
 *               workspace:
 *                 type: string
 *                 nullable: true
 *               origemExcelAba:
 *                 type: string
 *                 nullable: true
 *               responsavelId:
 *                 type: integer
 *                 nullable: true
 *               comments:
 *                 type: string
 *                 nullable: true
 *                 example: Atualização manual da demanda
 *     responses:
 *       200:
 *         description: Demanda atualizada com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Demand'
 *       404:
 *         description: Demanda não encontrada
 */
router.put('/:id', requireLevel(2), auditAction({ module: 'DEMANDS', action: 'DEMANDA_ATUALIZADA', description: 'Atualizou uma demanda', entity: 'Demand' }), controller.update);

/**
 * @swagger
 * /api/demands/{id}:
 *   delete:
 *     summary: Exclui uma demanda logicamente
 *     tags: [Demands]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *           example: 1
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               comments:
 *                 type: string
 *                 example: Registro removido após revisão
 *     responses:
 *       200:
 *         description: Demanda excluída com sucesso
 *       404:
 *         description: Demanda não encontrada
 */
router.delete('/:id', requireLevel(3), auditAction({ module: 'DEMANDS', action: 'DEMANDA_EXCLUIDA', description: 'Excluiu uma demanda logicamente', entity: 'Demand' }), controller.remove);

/**
 * @swagger
 * /api/demands/{id}/restore:
 *   patch:
 *     summary: Restaura uma demanda excluída logicamente
 *     tags: [Demands]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *           example: 1
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               comments:
 *                 type: string
 *                 example: Demanda restaurada após validação
 *     responses:
 *       200:
 *         description: Demanda restaurada com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Demand'
 *       404:
 *         description: Demanda não encontrada
 */
router.patch('/:id/restore', requireLevel(3), auditAction({ module: 'DEMANDS', action: 'DEMANDA_RESTAURADA', description: 'Restaurou uma demanda excluída', entity: 'Demand' }), controller.restore);

module.exports = router;