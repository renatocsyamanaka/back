const router = require('express').Router();
const auth = require('../middleware/auth');
const requireLevel = require('../middleware/rbac');

const partRequestController = require('../controllers/partRequestController');
const partRequestItemController = require('../controllers/partRequestItemController');
const auditAction = require('../middleware/auditAction');

/**
 * @swagger
 * tags:
 *   name: Pedidos de Peças
 *   description: Gestão de pedidos de peças
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     PartRequestItemInput:
 *       type: object
 *       required:
 *         - partName
 *         - requestedQty
 *       properties:
 *         partCode:
 *           type: string
 *           example: MOD-001
 *         partName:
 *           type: string
 *           example: Módulo rastreador
 *         unit:
 *           type: string
 *           example: UN
 *         requestedQty:
 *           type: integer
 *           example: 2
 *         itemRequestNote:
 *           type: string
 *           example: Necessário para atendimento da OS
 *
 *     PartRequestCreateInput:
 *       type: object
 *       required:
 *         - requesterName
 *         - items
 *       properties:
 *         requesterName:
 *           type: string
 *           example: Renato Yamanaka
 *         requesterDocument:
 *           type: string
 *           example: 12345678900
 *         requesterPhone:
 *           type: string
 *           example: 11999999999
 *         requesterEmail:
 *           type: string
 *           example: renato@email.com
 *         requestType:
 *           type: string
 *           enum: [ATENDIMENTO, TECNICO, OUTRO]
 *           example: ATENDIMENTO
 *         clientId:
 *           type: integer
 *           example: 10
 *         clientNameSnapshot:
 *           type: string
 *           example: Cliente XPTO
 *         providerId:
 *           type: integer
 *           example: 22
 *         providerNameSnapshot:
 *           type: string
 *           example: Prestador ABC
 *         technicianId:
 *           type: integer
 *           example: 31
 *         technicianNameSnapshot:
 *           type: string
 *           example: João Técnico
 *         region:
 *           type: string
 *           example: São Paulo
 *         occurrence:
 *           type: string
 *           example: Equipamento com defeito
 *         naCode:
 *           type: string
 *           example: NA123456
 *         osCode:
 *           type: string
 *           example: OS123456
 *         conversationKey:
 *           type: string
 *           example: whatsapp-123
 *         fulfillmentType:
 *           type: string
 *           enum: [RETIRADA, ENTREGA]
 *           example: ENTREGA
 *         invoiceNumber:
 *           type: string
 *           example: NF12345
 *         isExpedited:
 *           type: boolean
 *           example: false
 *         city:
 *           type: string
 *           example: São Paulo
 *         state:
 *           type: string
 *           example: SP
 *         scheduleSla:
 *           type: string
 *           example: 24h
 *         customerClassification:
 *           type: string
 *           example: VIP
 *         projectName:
 *           type: string
 *           example: Projeto Alpha
 *         requestNotes:
 *           type: string
 *           example: Pedido urgente
 *         managerId:
 *           type: integer
 *           example: 5
 *         items:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/PartRequestItemInput'
 *
 *     PartRequestUpdateInput:
 *       type: object
 *       properties:
 *         fulfillmentType:
 *           type: string
 *           enum: [RETIRADA, ENTREGA]
 *         invoiceNumber:
 *           type: string
 *         isExpedited:
 *           type: boolean
 *         requestNotes:
 *           type: string
 *         scheduleSla:
 *           type: string
 *         customerClassification:
 *           type: string
 *         projectName:
 *           type: string
 *         occurrence:
 *           type: string
 *         naCode:
 *           type: string
 *         osCode:
 *           type: string
 *
 *     BatchApproveInput:
 *       type: object
 *       required:
 *         - items
 *       properties:
 *         managerNote:
 *           type: string
 *           example: Aprovado parcialmente
 *         reasonCode:
 *           type: string
 *           example: ESTOQUE_PARCIAL
 *         reasonDetails:
 *           type: string
 *           example: Parte do material indisponível no momento
 *         items:
 *           type: array
 *           items:
 *             type: object
 *             required:
 *               - itemId
 *               - approvedQty
 *             properties:
 *               itemId:
 *                 type: integer
 *                 example: 10
 *               approvedQty:
 *                 type: integer
 *                 example: 1
 *               managerNote:
 *                 type: string
 *                 example: Aprovação parcial
 *               reasonCode:
 *                 type: string
 *                 example: FALTA_ESTOQUE
 *               reasonDetails:
 *                 type: string
 *                 example: Restante será enviado depois
 */

/**
 * @swagger
 * /part-requests/public:
 *   post:
 *     summary: Criar pedido de peças público
 *     tags: [Pedidos de Peças]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/PartRequestCreateInput'
 *     responses:
 *       201:
 *         description: Pedido criado com sucesso
 *       400:
 *         description: Dados inválidos
 *       500:
 *         description: Erro interno
 */
router.post(
  '/public',
  auditAction({
    module: 'PECAS_PEDIDOS',
    action: 'PEDIDO_PUBLICO_CRIADO',
    description: 'Criou pedido de peças público',
    entity: 'PartRequest',
  }),
  partRequestController.create
);

/**
 * @swagger
 * /part-requests/public/search:
 *   get:
 *     summary: Consultar pedido público por número e e-mail
 *     tags: [Pedidos de Peças]
 *     parameters:
 *       - in: query
 *         name: requestNumber
 *         required: true
 *         schema:
 *           type: string
 *         example: PP-2026-123456
 *       - in: query
 *         name: email
 *         required: true
 *         schema:
 *           type: string
 *         example: renato@email.com
 *     responses:
 *       200:
 *         description: Pedido encontrado
 *       404:
 *         description: Pedido não encontrado
 *       500:
 *         description: Erro interno
 */
router.get('/public/search', partRequestController.publicSearch);

/**
 * @swagger
 * /part-requests/nao-visualizados/count:
 *   get:
 *     summary: Contar pedidos de peças não visualizados
 *     tags: [Pedidos de Peças]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Quantidade retornada com sucesso
 *       401:
 *         description: Não autorizado
 *       500:
 *         description: Erro interno
 */
router.get('/nao-visualizados/count', auth(), partRequestController.countNaoVisualizados);

/**
 * @swagger
 * /part-requests:
 *   post:
 *     summary: Criar pedido de peças interno
 *     tags: [Pedidos de Peças]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/PartRequestCreateInput'
 *     responses:
 *       201:
 *         description: Pedido criado com sucesso
 *       400:
 *         description: Dados inválidos
 *       401:
 *         description: Não autorizado
 *       500:
 *         description: Erro interno
 */
router.post(
  '/',
  auth(),
  auditAction({
    module: 'PECAS_PEDIDOS',
    action: 'PEDIDO_INTERNO_CRIADO',
    description: 'Criou pedido de peças interno',
    entity: 'PartRequest',
  }),
  partRequestController.create
);

/**
 * @swagger
 * /part-requests:
 *   get:
 *     summary: Listar pedidos de peças
 *     tags: [Pedidos de Peças]
 *     security:
 *       - bearerAuth: []
 */
router.get('/', auth(), partRequestController.list);

/**
 * @swagger
 * /part-requests/{id}/visualizar:
 *   put:
 *     summary: Marcar pedido de peças como visualizado
 *     tags: [Pedidos de Peças]
 *     security:
 *       - bearerAuth: []
 */
router.put(
  '/:id/visualizar',
  auth(),
  auditAction({
    module: 'PECAS_PEDIDOS',
    action: 'PEDIDO_VISUALIZADO',
    description: 'Visualizou pedido de peças',
    entity: 'PartRequest',
  }),
  partRequestController.marcarComoVisualizado
);

/**
 * @swagger
 * /part-requests/{id}:
 *   get:
 *     summary: Buscar pedido de peças por ID
 *     tags: [Pedidos de Peças]
 *     security:
 *       - bearerAuth: []
 */
router.get('/:id', auth(), partRequestController.show);

/**
 * @swagger
 * /part-requests/{id}:
 *   patch:
 *     summary: Atualizar pedido de peças
 *     tags: [Pedidos de Peças]
 *     security:
 *       - bearerAuth: []
 */
router.patch(
  '/:id',
  auth(),
  requireLevel(2),
  auditAction({
    module: 'PECAS_PEDIDOS',
    action: 'PEDIDO_ATUALIZADO',
    description: 'Atualizou pedido de peças',
    entity: 'PartRequest',
  }),
  partRequestController.update
);

/**
 * @swagger
 * /part-requests/{id}/batch-approve:
 *   post:
 *     summary: Aprovar itens do pedido em lote
 *     tags: [Pedidos de Peças]
 *     security:
 *       - bearerAuth: []
 */
router.post(
  '/:id/batch-approve',
  auth(),
  requireLevel(3),
  auditAction({
    module: 'PECAS_PEDIDOS',
    action: 'PEDIDO_APROVADO_EM_LOTE',
    description: 'Aprovou itens do pedido de peças em lote',
    entity: 'PartRequest',
  }),
  partRequestController.batchApprove
);

/**
 * @swagger
 * /part-requests/items/{itemId}/approve:
 *   post:
 *     summary: Aprovar item individual do pedido
 *     tags: [Pedidos de Peças]
 *     security:
 *       - bearerAuth: []
 */
router.post(
  '/items/:itemId/approve',
  auth(),
  requireLevel(3),
  auditAction({
    module: 'PECAS_PEDIDOS',
    action: 'ITEM_PEDIDO_APROVADO',
    description: 'Aprovou item individual do pedido de peças',
    entity: 'PartRequestItem',
  }),
  partRequestItemController.approve
);

/**
 * @swagger
 * /part-requests/items/{itemId}/reject:
 *   post:
 *     summary: Rejeitar item individual do pedido
 *     tags: [Pedidos de Peças]
 *     security:
 *       - bearerAuth: []
 */
router.post(
  '/items/:itemId/reject',
  auth(),
  requireLevel(3),
  auditAction({
    module: 'PECAS_PEDIDOS',
    action: 'ITEM_PEDIDO_REJEITADO',
    description: 'Rejeitou item individual do pedido de peças',
    entity: 'PartRequestItem',
  }),
  partRequestItemController.reject
);

/**
 * @swagger
 * /part-requests/{id}:
 *   delete:
 *     summary: Excluir pedido de peças
 *     tags: [Pedidos de Peças]
 *     security:
 *       - bearerAuth: []
 */
router.delete(
  '/:id',
  auth(),
  requireLevel(2),
  auditAction({
    module: 'PECAS_PEDIDOS',
    action: 'PEDIDO_EXCLUIDO',
    description: 'Excluiu pedido de peças',
    entity: 'PartRequest',
  }),
  partRequestController.remove
);

module.exports = router;