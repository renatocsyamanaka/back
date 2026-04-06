/* src/routes/installationProjects.routes.js */
const router = require('express').Router();
const auth = require('../middleware/auth');
const requireLevel = require('../middleware/rbac');
const ctrl = require('../controllers/installationProjectController');
const uploadExcel = require('../middleware/uploadExcel');

/**
 * @swagger
 * tags:
 *   - name: InstallationProjects
 *     description: "Projetos de instalação (contato com cliente, agendamento, itens, progresso, e-mails e status)"
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     InstallationProjectStatus:
 *       type: string
 *       description: "Status do projeto"
 *       enum: [A_INICIAR, INICIADO, FINALIZADO]
 *
 *     InstallationProjectItem:
 *       type: object
 *       description: "Item/equipamento do projeto"
 *       properties:
 *         id: { type: integer, example: 10 }
 *         projectId: { type: integer, example: 1 }
 *         name: { type: string, example: "Rastreador X" }
 *         model: { type: string, nullable: true, example: "OMNI-ABC" }
 *         quantity: { type: integer, example: 50 }
 *         notes: { type: string, nullable: true, example: "Instalar no baú" }
 *         createdAt: { type: string, format: date-time }
 *         updatedAt: { type: string, format: date-time }
 *
 *     InstallationProjectProgress:
 *       type: object
 *       description: "Registro de progresso/diário do projeto"
 *       properties:
 *         id: { type: integer, example: 21 }
 *         projectId: { type: integer, example: 1 }
 *         date: { type: string, format: date, example: "2026-01-09" }
 *         trucksDone: { type: integer, example: 2 }
 *         trucksPending: { type: integer, nullable: true, example: 8 }
 *         notes: { type: string, nullable: true, example: "Cliente confirmou 2 caminhões hoje." }
 *         createdById: { type: integer, example: 9 }
 *         createdAt: { type: string, format: date-time }
 *         updatedAt: { type: string, format: date-time }
 *
 *     InstallationProject:
 *       type: object
 *       description: "Projeto de instalação"
 *       properties:
 *         id: { type: integer, example: 1 }
 *         clientName: { type: string, example: "Transportadora Exemplo LTDA" }
 *         clientEmail: { type: string, format: email, nullable: true, example: "contato@cliente.com.br" }
 *         clientPhone: { type: string, nullable: true, example: "+55 11 99999-9999" }
 *         city: { type: string, nullable: true, example: "São Paulo" }
 *         state: { type: string, nullable: true, example: "SP" }
 *         startDate: { type: string, format: date, nullable: true, example: "2026-01-10" }
 *         estimatedDays: { type: integer, nullable: true, example: 5 }
 *         trucksTotal: { type: integer, nullable: true, example: 10 }
 *         trucksDone: { type: integer, nullable: true, example: 3 }
 *         status:
 *           $ref: '#/components/schemas/InstallationProjectStatus'
 *         whatsappGroupName: { type: string, nullable: true, example: "Projeto - Cliente X - Jan/2026" }
 *         whatsappGroupLink: { type: string, nullable: true, example: "https://chat.whatsapp.com/xxxx" }
 *         notes: { type: string, nullable: true, example: "Projeto priorizado pelo cliente." }
 *         createdById: { type: integer, nullable: true, example: 9 }
 *         startedAt: { type: string, format: date-time, nullable: true }
 *         finishedAt: { type: string, format: date-time, nullable: true }
 *         createdAt: { type: string, format: date-time }
 *         updatedAt: { type: string, format: date-time }
 *
 *     InstallationProjectWithDetails:
 *       allOf:
 *         - $ref: '#/components/schemas/InstallationProject'
 *         - type: object
 *           properties:
 *             items:
 *               type: array
 *               items: { $ref: '#/components/schemas/InstallationProjectItem' }
 *             progress:
 *               type: array
 *               items: { $ref: '#/components/schemas/InstallationProjectProgress' }
 *
 *     ErrorResponse:
 *       type: object
 *       properties:
 *         ok: { type: boolean, example: false }
 *         message: { type: string, example: "Erro de validação" }
 */

/**
 * @swagger
 * /api/installation-projects:
 *   get:
 *     summary: "Lista projetos de instalação"
 *     tags: [InstallationProjects]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: status
 *         schema: { $ref: '#/components/schemas/InstallationProjectStatus' }
 *         description: "Filtrar por status (A_INICIAR, INICIADO, FINALIZADO)"
 *       - in: query
 *         name: q
 *         schema: { type: string }
 *         description: "Busca por cliente/telefone/e-mail (opcional)"
 *       - in: query
 *         name: page
 *         schema: { type: integer, example: 1 }
 *         description: "Página (opcional)"
 *       - in: query
 *         name: pageSize
 *         schema: { type: integer, example: 20 }
 *         description: "Tamanho da página (opcional)"
 *     responses:
 *       200:
 *         description: "Lista de projetos"
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ok: { type: boolean, example: true }
 *                 data:
 *                   type: object
 *                   properties:
 *                     rows:
 *                       type: array
 *                       items: { $ref: '#/components/schemas/InstallationProject' }
 *                     count: { type: integer, example: 32 }
 *       401: { description: "Não autenticado" }
 *       403:
 *         description: "Permissão insuficiente"
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 */

/**
 * @swagger
 * /api/installation-projects/{id}:
 *   get:
 *     summary: "Detalha um projeto (com itens e progresso)"
 *     tags: [InstallationProjects]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: "Projeto detalhado"
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ok: { type: boolean, example: true }
 *                 data: { $ref: '#/components/schemas/InstallationProjectWithDetails' }
 *       404: { description: "Projeto não encontrado" }
 *       401: { description: "Não autenticado" }
 *       403: { description: "Permissão insuficiente" }
 */

/**
 * @swagger
 * /api/installation-projects:
 *   post:
 *     summary: "Cria um novo projeto de instalação"
 *     tags: [InstallationProjects]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [clientName]
 *             properties:
 *               clientName: { type: string, example: "Transportadora Exemplo LTDA" }
 *               clientEmail: { type: string, format: email, nullable: true }
 *               clientPhone: { type: string, nullable: true }
 *               city: { type: string, nullable: true }
 *               state: { type: string, nullable: true }
 *               startDate: { type: string, format: date, nullable: true, example: "2026-01-10" }
 *               trucksTotal: { type: integer, nullable: true, example: 10 }
 *               estimatedDays:
 *                 type: integer
 *                 nullable: true
 *                 description: "Dias estimados (pode ser calculado no backend baseado em itens x capacidade/dia)"
 *               notes: { type: string, nullable: true }
 *     responses:
 *       201:
 *         description: "Projeto criado"
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ok: { type: boolean, example: true }
 *                 data: { $ref: '#/components/schemas/InstallationProject' }
 *       400:
 *         description: "Erro de validação"
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 *       401: { description: "Não autenticado" }
 *       403: { description: "Permissão insuficiente" }
 */

/**
 * @swagger
 * /api/installation-projects/{id}:
 *   patch:
 *     summary: "Atualiza dados do projeto"
 *     tags: [InstallationProjects]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               clientName: { type: string }
 *               clientEmail: { type: string, format: email, nullable: true }
 *               clientPhone: { type: string, nullable: true }
 *               city: { type: string, nullable: true }
 *               state: { type: string, nullable: true }
 *               startDate: { type: string, format: date, nullable: true }
 *               trucksTotal: { type: integer, nullable: true }
 *               estimatedDays: { type: integer, nullable: true }
 *               notes: { type: string, nullable: true }
 *               status: { $ref: '#/components/schemas/InstallationProjectStatus' }
 *     responses:
 *       200:
 *         description: "Projeto atualizado"
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ok: { type: boolean, example: true }
 *                 data: { $ref: '#/components/schemas/InstallationProject' }
 *       404: { description: "Projeto não encontrado" }
 *       401: { description: "Não autenticado" }
 *       403: { description: "Permissão insuficiente" }
 */

/**
 * @swagger
 * /api/installation-projects/{id}/whatsapp:
 *   patch:
 *     summary: "Salva nome/link do grupo do WhatsApp do projeto"
 *     tags: [InstallationProjects]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               whatsappGroupName: { type: string, example: "Projeto - Cliente X - Jan/2026" }
 *               whatsappGroupLink: { type: string, example: "https://chat.whatsapp.com/xxxx" }
 *     responses:
 *       200:
 *         description: "WhatsApp atualizado"
 *       404: { description: "Projeto não encontrado" }
 *       401: { description: "Não autenticado" }
 *       403: { description: "Permissão insuficiente" }
 */

/**
 * @swagger
 * /api/installation-projects/{id}/start:
 *   post:
 *     summary: "Inicia o projeto (atualiza status e pode disparar e-mail de início)"
 *     tags: [InstallationProjects]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               startDate: { type: string, format: date, nullable: true }
 *               sendEmail: { type: boolean, example: true }
 *               emailTo: { type: string, format: email, nullable: true, description: "Se não informado, usa clientEmail do projeto" }
 *               emailCc: { type: array, items: { type: string, format: email }, nullable: true }
 *               message: { type: string, nullable: true, description: "Mensagem adicional no e-mail" }
 *     responses:
 *       200:
 *         description: "Projeto iniciado"
 *       400: { description: "Erro de validação / projeto já iniciado" }
 *       404: { description: "Projeto não encontrado" }
 *       401: { description: "Não autenticado" }
 *       403: { description: "Permissão insuficiente" }
 */

/**
 * @swagger
 * /api/installation-projects/{id}/finish:
 *   post:
 *     summary: "Finaliza o projeto (atualiza status e pode disparar e-mail de encerramento)"
 *     tags: [InstallationProjects]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               sendEmail: { type: boolean, example: true }
 *               emailTo: { type: string, format: email, nullable: true }
 *               emailCc: { type: array, items: { type: string, format: email }, nullable: true }
 *               procedures: { type: string, nullable: true, description: "Procedimentos e orientações finais" }
 *     responses:
 *       200:
 *         description: "Projeto finalizado"
 *       400: { description: "Erro de validação / projeto não iniciado / já finalizado" }
 *       404: { description: "Projeto não encontrado" }
 *       401: { description: "Não autenticado" }
 *       403: { description: "Permissão insuficiente" }
 */

/**
 * @swagger
 * /api/installation-projects/{id}/items:
 *   post:
 *     summary: "Adiciona item/equipamento ao projeto"
 *     tags: [InstallationProjects]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, quantity]
 *             properties:
 *               name: { type: string, example: "Rastreador X" }
 *               model: { type: string, nullable: true, example: "OMNI-ABC" }
 *               quantity: { type: integer, example: 50 }
 *               notes: { type: string, nullable: true }
 *     responses:
 *       201:
 *         description: "Item adicionado"
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ok: { type: boolean, example: true }
 *                 data: { $ref: '#/components/schemas/InstallationProjectItem' }
 *       404: { description: "Projeto não encontrado" }
 *       400: { description: "Erro de validação" }
 *       401: { description: "Não autenticado" }
 *       403: { description: "Permissão insuficiente" }
 */

/**
 * @swagger
 * /api/installation-projects/{id}/progress:
 *   post:
 *     summary: "Registra progresso do projeto (caminhões feitos, observações, etc.)"
 *     tags: [InstallationProjects]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               date: { type: string, format: date, nullable: true, example: "2026-01-09" }
 *               trucksDone: { type: integer, example: 2 }
 *               trucksPending: { type: integer, nullable: true, example: 8 }
 *               notes: { type: string, nullable: true, example: "Instalação avançou em 2 caminhões." }
 *     responses:
 *       201:
 *         description: "Progresso registrado"
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ok: { type: boolean, example: true }
 *                 data: { $ref: '#/components/schemas/InstallationProjectProgress' }
 *       404: { description: "Projeto não encontrado" }
 *       400: { description: "Erro de validação" }
 *       401: { description: "Não autenticado" }
 *       403: { description: "Permissão insuficiente" }
 */

// ✅ Analista+ (2)
router.get('/', auth(), requireLevel(2), ctrl.list);
router.post('/import-base', auth(), requireLevel(1), uploadExcel.single('file'), ctrl.importBaseExcel);
router.patch( '/:id/convert-to-project', auth(),  requireLevel(1), ctrl.convertBaseToProject);

router.get('/:id', auth(), requireLevel(2), ctrl.getById);
router.put('/:id/progress/:progressId', auth(), requireLevel(2), ctrl.updateProgress);
router.delete('/:id/progress/:progressId', auth(), requireLevel(2), ctrl.removeProgress);

router.put('/:id/items/:itemId', auth(), requireLevel(2), ctrl.updateItem);
router.post('/', auth(), requireLevel(2), ctrl.create);
router.patch('/:id', auth(), requireLevel(2), ctrl.update);
router.delete('/:id/items/:itemId', auth(), requireLevel(2), ctrl.removeItem);
router.get('/:id/metrics', auth(), requireLevel(2), ctrl.getMetrics);
router.patch('/:id/whatsapp', auth(), requireLevel(2), ctrl.setWhatsApp);

router.post('/:id/start', auth(), requireLevel(2), ctrl.start);
router.post('/:id/finish', auth(), requireLevel(2), ctrl.finish);

router.post('/:id/items', auth(), requireLevel(2), ctrl.addItem);
router.post('/:id/progress', auth(), requireLevel(2), ctrl.addProgress);


// ✅ E-mails (Analista+)
router.post('/:id/emails/start', auth(), requireLevel(2), ctrl.sendStartEmail);
router.post('/:id/emails/daily', auth(), requireLevel(2), ctrl.sendDailyEmail);

router.post('/:id/emails/final', auth(), requireLevel(2), ctrl.sendFinalEmail);

module.exports = router;
