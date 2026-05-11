const express = require('express');
const router = express.Router();

const auth = require('../middleware/auth');
const requirePermission = require('../middleware/requirePermission');

const controller = require('../controllers/autoInventoryController');

/**
 * @swagger
 * tags:
 *   name: Auto Inventário
 *   description: Controle mensal de auto inventário de peças por prestador
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     AutoInventoryConfig:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *           example: 1
 *         sendDay:
 *           type: integer
 *           example: 20
 *         emailCc:
 *           type: string
 *           example: "renato.yamanaka@omnilink.com.br; supervisor@omnilink.com.br"
 *         enabled:
 *           type: boolean
 *           example: true
 *
 *     AutoInventoryItem:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *           example: 1
 *         codigo:
 *           type: string
 *           example: "00.2223.333"
 *         nome:
 *           type: string
 *           example: "MÓDULO"
 *         ativo:
 *           type: boolean
 *           example: true
 *
 *     AutoInventoryCycle:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *           example: 1
 *         month:
 *           type: integer
 *           example: 5
 *         year:
 *           type: integer
 *           example: 2026
 *         status:
 *           type: string
 *           example: "ABERTO"
 *         sendDate:
 *           type: string
 *           format: date-time
 *           nullable: true
 *
 *     AutoInventoryPublicItem:
 *       type: object
 *       properties:
 *         itemId:
 *           type: integer
 *           example: 1
 *         quantidade:
 *           type: integer
 *           example: 3
 */

// =======================
// CONFIGURAÇÕES
// =======================

/**
 * @swagger
 * /auto-inventory/config:
 *   get:
 *     summary: Buscar configuração global do auto inventário
 *     tags: [Auto Inventário]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Configuração carregada com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AutoInventoryConfig'
 *       401:
 *         description: Não autenticado
 *       403:
 *         description: Sem permissão
 */
router.get(
  '/config',
  auth(),
  requirePermission('AUTO_INVENTORY_VIEW'),
  controller.getConfig
);

/**
 * @swagger
 * /auto-inventory/config:
 *   patch:
 *     summary: Atualizar configuração global do auto inventário
 *     tags: [Auto Inventário]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               sendDay:
 *                 type: integer
 *                 minimum: 1
 *                 maximum: 31
 *                 example: 20
 *               emailCc:
 *                 type: string
 *                 example: "renato.yamanaka@omnilink.com.br; supervisor@omnilink.com.br"
 *               enabled:
 *                 type: boolean
 *                 example: true
 *     responses:
 *       200:
 *         description: Configuração atualizada com sucesso
 *       400:
 *         description: Dados inválidos
 *       401:
 *         description: Não autenticado
 *       403:
 *         description: Sem permissão
 */
router.patch(
  '/config',
  auth(),
  requirePermission('AUTO_INVENTORY_ADMIN'),
  controller.updateConfig
);

// =======================
// CICLOS
// =======================

/**
 * @swagger
 * /auto-inventory/cycles:
 *   post:
 *     summary: Criar ciclo mensal de auto inventário
 *     tags: [Auto Inventário]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - month
 *               - year
 *             properties:
 *               month:
 *                 type: integer
 *                 example: 5
 *               year:
 *                 type: integer
 *                 example: 2026
 *     responses:
 *       201:
 *         description: Ciclo criado com sucesso
 *       400:
 *         description: Já existe ciclo ou dados inválidos
 *       401:
 *         description: Não autenticado
 *       403:
 *         description: Sem permissão
 */
router.post(
  '/cycles',
  auth(),
  requirePermission('AUTO_INVENTORY_ADMIN'),
  controller.createCycle
);

/**
 * @swagger
 * /auto-inventory/cycles:
 *   get:
 *     summary: Listar ciclos mensais
 *     tags: [Auto Inventário]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lista de ciclos
 *       401:
 *         description: Não autenticado
 *       403:
 *         description: Sem permissão
 */
router.get(
  '/cycles',
  auth(),
  requirePermission('AUTO_INVENTORY_VIEW'),
  controller.listCycles
);

/**
 * @swagger
 * /auto-inventory/cycles/sync-providers:
 *   post:
 *     summary: Sincronizar prestadores habilitados e peças ativas no ciclo
 *     tags: [Auto Inventário]
 *     security:
 *       - bearerAuth: []
 *     description: Adiciona ao ciclo todos os prestadores com autoInventoryEnabled=true e todas as peças ativas que ainda não estiverem vinculadas.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - month
 *               - year
 *             properties:
 *               month:
 *                 type: integer
 *                 example: 5
 *               year:
 *                 type: integer
 *                 example: 2026
 *     responses:
 *       200:
 *         description: Ciclo sincronizado com sucesso
 *       404:
 *         description: Ciclo não encontrado
 *       401:
 *         description: Não autenticado
 *       403:
 *         description: Sem permissão
 */
router.post(
  '/cycles/sync-providers',
  auth(),
  requirePermission('AUTO_INVENTORY_ADMIN'),
  controller.syncCycleProviders
);

/**
 * @swagger
 * /auto-inventory/cycles/send-emails:
 *   post:
 *     summary: Enviar e-mails do ciclo manualmente
 *     tags: [Auto Inventário]
 *     security:
 *       - bearerAuth: []
 *     description: Envia e-mails para prestadores pendentes ou parciais, usando os e-mails em cópia configurados em /config.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - month
 *               - year
 *             properties:
 *               month:
 *                 type: integer
 *                 example: 5
 *               year:
 *                 type: integer
 *                 example: 2026
 *     responses:
 *       200:
 *         description: E-mails enviados com sucesso
 *       404:
 *         description: Ciclo não encontrado
 *       401:
 *         description: Não autenticado
 *       403:
 *         description: Sem permissão
 */
router.post(
  '/cycles/send-emails',
  auth(),
  requirePermission('AUTO_INVENTORY_ADMIN'),
  controller.sendCycleEmails
);

// =======================
// DASHBOARD
// =======================

/**
 * @swagger
 * /auto-inventory/dashboard:
 *   get:
 *     summary: Dashboard do auto inventário mensal
 *     tags: [Auto Inventário]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: month
 *         schema:
 *           type: integer
 *         example: 5
 *       - in: query
 *         name: year
 *         schema:
 *           type: integer
 *         example: 2026
 *     responses:
 *       200:
 *         description: Resumo mensal por prestador
 *       404:
 *         description: Ciclo não encontrado
 *       401:
 *         description: Não autenticado
 *       403:
 *         description: Sem permissão
 */
router.get(
  '/dashboard',
  auth(),
  requirePermission('AUTO_INVENTORY_VIEW'),
  controller.getDashboard
);

// =======================
// PRESTADORES
// =======================

/**
 * @swagger
 * /auto-inventory/providers/{providerId}:
 *   get:
 *     summary: Visualizar inventário de um prestador
 *     tags: [Auto Inventário]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: providerId
 *         required: true
 *         schema:
 *           type: integer
 *         example: 207
 *       - in: query
 *         name: month
 *         schema:
 *           type: integer
 *         example: 5
 *       - in: query
 *         name: year
 *         schema:
 *           type: integer
 *         example: 2026
 *     responses:
 *       200:
 *         description: Inventário do prestador
 *       404:
 *         description: Inventário não encontrado
 *       401:
 *         description: Não autenticado
 *       403:
 *         description: Sem permissão
 */
router.get(
  '/providers/:providerId',
  auth(),
  requirePermission('AUTO_INVENTORY_VIEW'),
  controller.getProviderInventory
);

/**
 * @swagger
 * /auto-inventory/providers/{providerId}/resend:
 *   post:
 *     summary: Reenviar link do auto inventário para um prestador
 *     tags: [Auto Inventário]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: providerId
 *         required: true
 *         schema:
 *           type: integer
 *         example: 207
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - month
 *               - year
 *             properties:
 *               month:
 *                 type: integer
 *                 example: 5
 *               year:
 *                 type: integer
 *                 example: 2026
 *     responses:
 *       200:
 *         description: Solicitação reenviada com sucesso
 *       404:
 *         description: Ciclo ou inventário não encontrado
 *       401:
 *         description: Não autenticado
 *       403:
 *         description: Sem permissão
 */
router.post(
  '/providers/:providerId/resend',
  auth(),
  requirePermission('AUTO_INVENTORY_ADMIN'),
  controller.resendProviderInventory
);

// =======================
// PEÇAS
// =======================

/**
 * @swagger
 * /auto-inventory/items:
 *   post:
 *     summary: Cadastrar peça global do auto inventário
 *     tags: [Auto Inventário]
 *     security:
 *       - bearerAuth: []
 *     description: Peça cadastrada como ativa entra para todos os prestadores ao sincronizar o ciclo.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - codigo
 *               - nome
 *             properties:
 *               codigo:
 *                 type: string
 *                 example: "00.2223.333"
 *               nome:
 *                 type: string
 *                 example: "MÓDULO"
 *     responses:
 *       201:
 *         description: Peça cadastrada com sucesso
 *       400:
 *         description: Código/nome obrigatório ou peça duplicada
 *       401:
 *         description: Não autenticado
 *       403:
 *         description: Sem permissão
 */
router.post(
  '/items',
  auth(),
  requirePermission('AUTO_INVENTORY_ADMIN'),
  controller.createItem
);

/**
 * @swagger
 * /auto-inventory/items:
 *   get:
 *     summary: Listar peças globais do auto inventário
 *     tags: [Auto Inventário]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lista de peças
 *       401:
 *         description: Não autenticado
 *       403:
 *         description: Sem permissão
 */
router.get(
  '/items',
  auth(),
  requirePermission('AUTO_INVENTORY_VIEW'),
  controller.listItems
);

/**
 * @swagger
 * /auto-inventory/items/{id}:
 *   patch:
 *     summary: Atualizar peça do auto inventário
 *     tags: [Auto Inventário]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         example: 1
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               codigo:
 *                 type: string
 *                 example: "00.2223.333"
 *               nome:
 *                 type: string
 *                 example: "MÓDULO"
 *               ativo:
 *                 type: boolean
 *                 example: true
 *     responses:
 *       200:
 *         description: Peça atualizada com sucesso
 *       404:
 *         description: Peça não encontrada
 *       401:
 *         description: Não autenticado
 *       403:
 *         description: Sem permissão
 */
router.patch(
  '/items/:id',
  auth(),
  requirePermission('AUTO_INVENTORY_ADMIN'),
  controller.updateItem
);

// =======================
// EXPORTAÇÃO
// =======================

/**
 * @swagger
 * /auto-inventory/export:
 *   get:
 *     summary: Exportar inventário mensal em Excel
 *     tags: [Auto Inventário]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: month
 *         required: true
 *         schema:
 *           type: integer
 *         example: 5
 *       - in: query
 *         name: year
 *         required: true
 *         schema:
 *           type: integer
 *         example: 2026
 *       - in: query
 *         name: providerId
 *         required: false
 *         schema:
 *           type: integer
 *         example: 207
 *     responses:
 *       200:
 *         description: Arquivo Excel gerado
 *         content:
 *           application/vnd.openxmlformats-officedocument.spreadsheetml.sheet:
 *             schema:
 *               type: string
 *               format: binary
 *       400:
 *         description: Mês e ano obrigatórios
 *       404:
 *         description: Ciclo não encontrado
 *       401:
 *         description: Não autenticado
 *       403:
 *         description: Sem permissão
 */
router.get(
  '/export',
  auth(),
  requirePermission('AUTO_INVENTORY_VIEW'),
  controller.exportMonthlyInventory
);

// =======================
// ROTAS PÚBLICAS
// =======================

/**
 * @swagger
 * /auto-inventory/public/{token}:
 *   get:
 *     summary: Abrir link público do auto inventário
 *     tags: [Auto Inventário]
 *     parameters:
 *       - in: path
 *         name: token
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Inventário público carregado
 *       404:
 *         description: Link inválido ou expirado
 */
router.get(
  '/public/:token',
  controller.getPublicInventory
);

/**
 * @swagger
 * /auto-inventory/public/{token}:
 *   put:
 *     summary: Salvar preenchimento público do auto inventário
 *     tags: [Auto Inventário]
 *     parameters:
 *       - in: path
 *         name: token
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               finalizar:
 *                 type: boolean
 *                 example: false
 *               items:
 *                 type: array
 *                 items:
 *                   $ref: '#/components/schemas/AutoInventoryPublicItem'
 *     responses:
 *       200:
 *         description: Inventário salvo com sucesso
 *       404:
 *         description: Link inválido ou expirado
 */
router.put(
  '/public/:token',
  controller.updatePublicInventory
);

module.exports = router;