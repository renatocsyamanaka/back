const express = require('express');
const router = express.Router();

const auth = require('../middleware/auth');
const requirePermission = require('../middleware/requirePermission');

const controller = require('../controllers/whatsappController');
const sessionController = require('../controllers/whatsappSessionController');

/**
 * @swagger
 * tags:
 *   - name: WhatsApp
 *     description: Integração com WAHA e gerenciamento de conversas
 */

/**
 * @swagger
 * /api/whatsapp/session/status:
 *   get:
 *     summary: Retorna o status da sessão WhatsApp
 *     tags: [WhatsApp]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Status da sessão
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               example:
 *                 name: default
 *                 status: WORKING
 *       403:
 *         description: Sem permissão
 *       500:
 *         description: Erro interno
 */
router.get(
  '/session/status',
  auth(),
  requirePermission('WHATSAPP_VIEW'),
  sessionController.status
);

/**
 * @swagger
 * /api/whatsapp/session/connect:
 *   post:
 *     summary: Inicia a sessão WhatsApp existente
 *     tags: [WhatsApp]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Sessão iniciada
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               example:
 *                 ok: true
 *                 started: true
 *       403:
 *         description: Sem permissão
 *       500:
 *         description: Erro interno
 */
router.post(
  '/session/connect',
  auth(),
  requirePermission('WHATSAPP_VIEW'),
  sessionController.connect
);

/**
 * @swagger
 * /api/whatsapp/session/qr:
 *   get:
 *     summary: Retorna o QR Code da sessão WAHA
 *     tags: [WhatsApp]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: QR Code retornado com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               example:
 *                 mimetype: image/png
 *                 data: iVBORw0KGgoAAAANSUhEUgAA...
 *       404:
 *         description: Sessão não encontrada
 *       500:
 *         description: Erro interno
 */
router.get(
  '/session/qr',
  auth(),
  requirePermission('WHATSAPP_VIEW'),
  sessionController.qr
);

/**
 * @swagger
 * /api/whatsapp/session/logout:
 *   post:
 *     summary: Desconecta a sessão WhatsApp
 *     tags: [WhatsApp]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Sessão desconectada
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               example:
 *                 ok: true
 *       403:
 *         description: Sem permissão
 *       500:
 *         description: Erro interno
 */
router.post(
  '/session/logout',
  auth(),
  requirePermission('WHATSAPP_VIEW'),
  sessionController.logout
);

/**
 * @swagger
 * /api/whatsapp/session/restart:
 *   post:
 *     summary: Reinicia a sessão WhatsApp
 *     tags: [WhatsApp]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Sessão reiniciada
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               example:
 *                 ok: true
 *                 status:
 *                   name: default
 *                   status: SCAN_QR_CODE
 *                 started: true
 *       403:
 *         description: Sem permissão
 *       500:
 *         description: Erro interno
 */
router.post(
  '/session/restart',
  auth(),
  requirePermission('WHATSAPP_VIEW'),
  sessionController.restart
);

/**
 * @swagger
 * /api/whatsapp/session/debug:
 *   get:
 *     summary: Lista informações de debug da sessão
 *     tags: [WhatsApp]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Debug retornado com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               example:
 *                 - name: default
 *                   status: WORKING
 *       403:
 *         description: Sem permissão
 *       500:
 *         description: Erro interno
 */
router.get(
  '/session/debug',
  auth(),
  requirePermission('WHATSAPP_VIEW'),
  sessionController.debug
);

/**
 * @swagger
 * /api/whatsapp/conversations:
 *   get:
 *     summary: Lista conversas do WhatsApp
 *     tags: [WhatsApp]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lista de conversas
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               example:
 *                 - id: 1
 *                   contactName: Renato
 *                   phone: "5511999999999"
 *                   status: OPEN
 *       403:
 *         description: Sem permissão
 *       500:
 *         description: Erro interno
 */
router.get(
  '/conversations',
  auth(),
  requirePermission('WHATSAPP_VIEW'),
  controller.list
);

/**
 * @swagger
 * /api/whatsapp/conversations/{id}:
 *   get:
 *     summary: Retorna os detalhes de uma conversa
 *     tags: [WhatsApp]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID da conversa
 *     responses:
 *       200:
 *         description: Conversa encontrada
 *       404:
 *         description: Conversa não encontrada
 *       500:
 *         description: Erro interno
 */
router.get(
  '/conversations/:id',
  auth(),
  requirePermission('WHATSAPP_VIEW'),
  controller.detail
);

/**
 * @swagger
 * /api/whatsapp/send:
 *   post:
 *     summary: Envia mensagem manual pelo WhatsApp
 *     tags: [WhatsApp]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - phone
 *               - text
 *             properties:
 *               phone:
 *                 type: string
 *                 example: "5511999999999"
 *               text:
 *                 type: string
 *                 example: "Olá, tudo bem?"
 *     responses:
 *       200:
 *         description: Mensagem enviada com sucesso
 *       400:
 *         description: Dados inválidos
 *       403:
 *         description: Sem permissão
 *       500:
 *         description: Erro interno
 */
router.post(
  '/send',
  auth(),
  requirePermission('WHATSAPP_VIEW'),
  controller.send
);

/**
 * @swagger
 * /api/whatsapp/webhook:
 *   post:
 *     summary: Recebe eventos do WAHA
 *     tags: [WhatsApp]
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             example:
 *               event: message
 *               payload:
 *                 id: "msg_123"
 *                 from: "5511999999999@c.us"
 *                 body: "Bom dia"
 *                 fromMe: false
 *     responses:
 *       200:
 *         description: Evento recebido com sucesso
 *       500:
 *         description: Erro interno
 */
router.post('/webhook', controller.webhook);
router.post(
  '/conversations/:id/send',
  auth(),
  requirePermission('WHATSAPP_VIEW'),
  controller.send
);
module.exports = router;