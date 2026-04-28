/* src/routes/installationProjects.routes.js */

const router = require('express').Router();
const auth = require('../middleware/auth');
const requireLevel = require('../middleware/rbac');
const ctrl = require('../controllers/installationProjectController');
const uploadExcel = require('../middleware/uploadExcel');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const auditAction = require('../middleware/auditAction');

const logoDir = path.join(__dirname, '../../uploads/daily-report-logos');

if (!fs.existsSync(logoDir)) {
  fs.mkdirSync(logoDir, { recursive: true });
}

const logoStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, logoDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname || '.png');
    cb(null, `project-${req.params.id}-${Date.now()}${ext}`);
  },
});

const uploadLogo = multer({
  storage: logoStorage,
  fileFilter: (req, file, cb) => {
    const allowed = ['image/png', 'image/jpeg', 'image/jpg'];

    if (!allowed.includes(file.mimetype)) {
      return cb(new Error('Envie uma logo em PNG ou JPG. SVG não funciona bem em e-mail.'));
    }

    cb(null, true);
  },
});

/**
 * @swagger
 * tags:
 *   - name: InstallationProjects
 *     description: Projetos de instalação, itens, progresso, status, importações, logos, WhatsApp e e-mails
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     InstallationProjectStatus:
 *       type: string
 *       enum: [A_INICIAR, INICIADO, FINALIZADO]
 *
 *     InstallationProject:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *           example: 1
 *         title:
 *           type: string
 *           example: Projeto Cliente XPTO
 *         clientName:
 *           type: string
 *           example: Transportadora Exemplo LTDA
 *         status:
 *           $ref: '#/components/schemas/InstallationProjectStatus'
 *         recordType:
 *           type: string
 *           example: PROJECT
 *         trucksTotal:
 *           type: integer
 *           example: 100
 *         trucksDone:
 *           type: integer
 *           example: 30
 *         equipmentsPerDay:
 *           type: integer
 *           example: 10
 *         contactEmail:
 *           type: string
 *           nullable: true
 *           example: cliente@empresa.com.br
 *         contactEmails:
 *           type: array
 *           items:
 *             type: string
 *           example: ["cliente@empresa.com.br"]
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 *
 *     InstallationProjectItem:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *           example: 10
 *         projectId:
 *           type: integer
 *           example: 1
 *         name:
 *           type: string
 *           example: OMNITURBO
 *         quantity:
 *           type: integer
 *           example: 50
 *
 *     InstallationProjectProgress:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *           example: 20
 *         projectId:
 *           type: integer
 *           example: 1
 *         date:
 *           type: string
 *           format: date
 *           example: 2026-04-28
 *         trucksDoneToday:
 *           type: integer
 *           example: 5
 *         notes:
 *           type: string
 *           nullable: true
 *           example: Lançamento diário de progresso
 *
 *     ErrorResponse:
 *       type: object
 *       properties:
 *         ok:
 *           type: boolean
 *           example: false
 *         message:
 *           type: string
 *           example: Erro ao processar solicitação
 */

/**
 * @swagger
 * /api/installation-projects:
 *   get:
 *     summary: Lista projetos de instalação
 *     tags: [InstallationProjects]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *       - in: query
 *         name: q
 *         schema:
 *           type: string
 *       - in: query
 *         name: recordType
 *         schema:
 *           type: string
 *           example: PROJECT
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           example: 1
 *       - in: query
 *         name: pageSize
 *         schema:
 *           type: integer
 *           example: 20
 *     responses:
 *       200:
 *         description: Lista retornada com sucesso
 */
router.get('/', auth(), requireLevel(2), ctrl.list);

/**
 * @swagger
 * /api/installation-projects/import-base:
 *   post:
 *     summary: Importa base de projetos por Excel
 *     tags: [InstallationProjects]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [file]
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: Base importada com sucesso
 */
router.post(
  '/import-base',
  auth(),
  requireLevel(1),
  uploadExcel.single('file'),
  auditAction({
    module: 'PROJETOS_INSTALACAO',
    action: 'BASE_IMPORTADA',
    description: 'Importou base de projetos de instalação via Excel',
    entity: 'InstallationProject',
  }),
  ctrl.importBaseExcel
);

/**
 * @swagger
 * /api/installation-projects:
 *   post:
 *     summary: Cria projeto de instalação
 *     tags: [InstallationProjects]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title:
 *                 type: string
 *                 example: Projeto Cliente XPTO
 *               clientName:
 *                 type: string
 *                 example: Cliente XPTO
 *               trucksTotal:
 *                 type: integer
 *                 example: 100
 *               equipmentsPerDay:
 *                 type: integer
 *                 example: 10
 *               contactEmails:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       201:
 *         description: Projeto criado com sucesso
 */
router.post(
  '/',
  auth(),
  requireLevel(2),
  auditAction({
    module: 'PROJETOS_INSTALACAO',
    action: 'PROJETO_CRIADO',
    description: 'Criou um projeto de instalação',
    entity: 'InstallationProject',
  }),
  ctrl.create
);

/**
 * @swagger
 * /api/installation-projects/{id}:
 *   get:
 *     summary: Detalha projeto de instalação
 *     tags: [InstallationProjects]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Projeto encontrado
 */
router.get('/:id', auth(), requireLevel(2), ctrl.getById);

/**
 * @swagger
 * /api/installation-projects/{id}/metrics:
 *   get:
 *     summary: Busca métricas do projeto
 *     tags: [InstallationProjects]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Métricas retornadas com sucesso
 */
router.get('/:id/metrics', auth(), requireLevel(2), ctrl.getMetrics);

/**
 * @swagger
 * /api/installation-projects/{id}:
 *   patch:
 *     summary: Atualiza projeto de instalação
 *     tags: [InstallationProjects]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Projeto atualizado com sucesso
 */
router.patch(
  '/:id',
  auth(),
  requireLevel(2),
  auditAction({
    module: 'PROJETOS_INSTALACAO',
    action: 'PROJETO_ATUALIZADO',
    description: 'Atualizou um projeto de instalação',
    entity: 'InstallationProject',
  }),
  ctrl.update
);

/**
 * @swagger
 * /api/installation-projects/{id}:
 *   delete:
 *     summary: Exclui projeto de instalação
 *     tags: [InstallationProjects]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Projeto excluído com sucesso
 */
router.delete(
  '/:id',
  auth(),
  requireLevel(2),
  auditAction({
    module: 'PROJETOS_INSTALACAO',
    action: 'PROJETO_EXCLUIDO',
    description: 'Excluiu um projeto de instalação',
    entity: 'InstallationProject',
  }),
  ctrl.remove
);

/**
 * @swagger
 * /api/installation-projects/{id}/record-type:
 *   patch:
 *     summary: Altera tipo do registro do projeto
 *     tags: [InstallationProjects]
 *     security:
 *       - bearerAuth: []
 */
router.patch(
  '/:id/record-type',
  auth(),
  requireLevel(2),
  auditAction({
    module: 'PROJETOS_INSTALACAO',
    action: 'TIPO_REGISTRO_ALTERADO',
    description: 'Alterou o tipo do registro do projeto',
    entity: 'InstallationProject',
  }),
  ctrl.changeRecordType
);

/**
 * @swagger
 * /api/installation-projects/{id}/convert-to-project:
 *   patch:
 *     summary: Converte uma base em projeto
 *     tags: [InstallationProjects]
 *     security:
 *       - bearerAuth: []
 */
router.patch(
  '/:id/convert-to-project',
  auth(),
  requireLevel(1),
  auditAction({
    module: 'PROJETOS_INSTALACAO',
    action: 'BASE_CONVERTIDA_EM_PROJETO',
    description: 'Converteu uma base em projeto de instalação',
    entity: 'InstallationProject',
  }),
  ctrl.convertBaseToProject
);

/**
 * @swagger
 * /api/installation-projects/{id}/whatsapp:
 *   patch:
 *     summary: Atualiza dados de WhatsApp do projeto
 *     tags: [InstallationProjects]
 *     security:
 *       - bearerAuth: []
 */
router.patch(
  '/:id/whatsapp',
  auth(),
  requireLevel(2),
  auditAction({
    module: 'PROJETOS_INSTALACAO',
    action: 'WHATSAPP_ATUALIZADO',
    description: 'Atualizou dados de WhatsApp do projeto',
    entity: 'InstallationProject',
  }),
  ctrl.setWhatsApp
);

/**
 * @swagger
 * /api/installation-projects/{id}/start:
 *   post:
 *     summary: Inicia projeto de instalação
 *     tags: [InstallationProjects]
 *     security:
 *       - bearerAuth: []
 */
router.post(
  '/:id/start',
  auth(),
  requireLevel(2),
  auditAction({
    module: 'PROJETOS_INSTALACAO',
    action: 'PROJETO_INICIADO',
    description: 'Iniciou um projeto de instalação',
    entity: 'InstallationProject',
  }),
  ctrl.start
);

/**
 * @swagger
 * /api/installation-projects/{id}/finish:
 *   post:
 *     summary: Finaliza projeto de instalação
 *     tags: [InstallationProjects]
 *     security:
 *       - bearerAuth: []
 */
router.post(
  '/:id/finish',
  auth(),
  requireLevel(2),
  auditAction({
    module: 'PROJETOS_INSTALACAO',
    action: 'PROJETO_FINALIZADO',
    description: 'Finalizou um projeto de instalação',
    entity: 'InstallationProject',
  }),
  ctrl.finish
);

/**
 * @swagger
 * /api/installation-projects/{id}/upload-daily-report-logo:
 *   post:
 *     summary: Envia logo do relatório diário
 *     tags: [InstallationProjects]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [file]
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 */
router.post(
  '/:id/upload-daily-report-logo',
  auth(),
  requireLevel(2),
  uploadLogo.single('file'),
  auditAction({
    module: 'PROJETOS_INSTALACAO',
    action: 'LOGO_RELATORIO_DIARIO_ENVIADA',
    description: 'Enviou logo do relatório diário',
    entity: 'InstallationProject',
  }),
  ctrl.uploadDailyReportLogo
);

/**
 * @swagger
 * /api/installation-projects/{id}/delete-daily-report-logo:
 *   delete:
 *     summary: Exclui logo do relatório diário
 *     tags: [InstallationProjects]
 *     security:
 *       - bearerAuth: []
 */
router.delete(
  '/:id/delete-daily-report-logo',
  auth(),
  requireLevel(2),
  auditAction({
    module: 'PROJETOS_INSTALACAO',
    action: 'LOGO_RELATORIO_DIARIO_EXCLUIDA',
    description: 'Excluiu logo do relatório diário',
    entity: 'InstallationProject',
  }),
  ctrl.deleteDailyReportLogo
);

/**
 * @swagger
 * /api/installation-projects/{id}/items:
 *   post:
 *     summary: Adiciona item ao projeto
 *     tags: [InstallationProjects]
 *     security:
 *       - bearerAuth: []
 */
router.post(
  '/:id/items',
  auth(),
  requireLevel(2),
  auditAction({
    module: 'PROJETOS_INSTALACAO',
    action: 'ITEM_CRIADO',
    description: 'Adicionou item ao projeto de instalação',
    entity: 'InstallationProjectItem',
  }),
  ctrl.addItem
);

/**
 * @swagger
 * /api/installation-projects/{id}/items/{itemId}:
 *   put:
 *     summary: Atualiza item do projeto
 *     tags: [InstallationProjects]
 *     security:
 *       - bearerAuth: []
 */
router.put(
  '/:id/items/:itemId',
  auth(),
  requireLevel(2),
  auditAction({
    module: 'PROJETOS_INSTALACAO',
    action: 'ITEM_ATUALIZADO',
    description: 'Atualizou item do projeto de instalação',
    entity: 'InstallationProjectItem',
  }),
  ctrl.updateItem
);

/**
 * @swagger
 * /api/installation-projects/{id}/items/{itemId}:
 *   delete:
 *     summary: Exclui item do projeto
 *     tags: [InstallationProjects]
 *     security:
 *       - bearerAuth: []
 */
router.delete(
  '/:id/items/:itemId',
  auth(),
  requireLevel(2),
  auditAction({
    module: 'PROJETOS_INSTALACAO',
    action: 'ITEM_EXCLUIDO',
    description: 'Excluiu item do projeto de instalação',
    entity: 'InstallationProjectItem',
  }),
  ctrl.removeItem
);

/**
 * @swagger
 * /api/installation-projects/{id}/progress:
 *   post:
 *     summary: Lança progresso no projeto
 *     tags: [InstallationProjects]
 *     security:
 *       - bearerAuth: []
 */
router.post(
  '/:id/progress',
  auth(),
  requireLevel(2),
  auditAction({
    module: 'PROJETOS_INSTALACAO',
    action: 'PROGRESSO_CRIADO',
    description: 'Lançou progresso no projeto de instalação',
    entity: 'InstallationProjectProgress',
  }),
  ctrl.addProgress
);

/**
 * @swagger
 * /api/installation-projects/{id}/progress/{progressId}:
 *   put:
 *     summary: Atualiza progresso do projeto
 *     tags: [InstallationProjects]
 *     security:
 *       - bearerAuth: []
 */
router.put(
  '/:id/progress/:progressId',
  auth(),
  requireLevel(2),
  auditAction({
    module: 'PROJETOS_INSTALACAO',
    action: 'PROGRESSO_ATUALIZADO',
    description: 'Atualizou progresso do projeto de instalação',
    entity: 'InstallationProjectProgress',
  }),
  ctrl.updateProgress
);

/**
 * @swagger
 * /api/installation-projects/{id}/progress/{progressId}:
 *   delete:
 *     summary: Exclui progresso do projeto
 *     tags: [InstallationProjects]
 *     security:
 *       - bearerAuth: []
 */
router.delete(
  '/:id/progress/:progressId',
  auth(),
  requireLevel(2),
  auditAction({
    module: 'PROJETOS_INSTALACAO',
    action: 'PROGRESSO_EXCLUIDO',
    description: 'Excluiu progresso do projeto de instalação',
    entity: 'InstallationProjectProgress',
  }),
  ctrl.removeProgress
);

/**
 * @swagger
 * /api/installation-projects/{id}/daily-report/settings:
 *   patch:
 *     summary: Atualiza configurações do relatório diário
 *     tags: [InstallationProjects]
 *     security:
 *       - bearerAuth: []
 */
router.patch(
  '/:id/daily-report/settings',
  auth(),
  requireLevel(2),
  auditAction({
    module: 'PROJETOS_INSTALACAO',
    action: 'CONFIG_RELATORIO_DIARIO_ATUALIZADA',
    description: 'Atualizou configurações do relatório diário',
    entity: 'InstallationProject',
  }),
  ctrl.updateDailyReportSettings
);

/**
 * @swagger
 * /api/installation-projects/{id}/daily-report/send-now:
 *   post:
 *     summary: Envia relatório diário manualmente
 *     tags: [InstallationProjects]
 *     security:
 *       - bearerAuth: []
 */
router.post(
  '/:id/daily-report/send-now',
  auth(),
  requireLevel(2),
  auditAction({
    module: 'PROJETOS_INSTALACAO',
    action: 'RELATORIO_DIARIO_ENVIADO_MANUALMENTE',
    description: 'Enviou relatório diário manualmente',
    entity: 'InstallationProject',
  }),
  ctrl.sendDailyReportNow
);

/**
 * @swagger
 * /api/installation-projects/{id}/emails/start:
 *   post:
 *     summary: Envia e-mail inicial do projeto
 *     tags: [InstallationProjects]
 *     security:
 *       - bearerAuth: []
 */
router.post(
  '/:id/emails/start',
  auth(),
  requireLevel(2),
  auditAction({
    module: 'PROJETOS_INSTALACAO',
    action: 'EMAIL_INICIAL_ENVIADO',
    description: 'Enviou e-mail inicial do projeto',
    entity: 'InstallationProject',
  }),
  ctrl.sendStartEmail
);

/**
 * @swagger
 * /api/installation-projects/{id}/emails/daily:
 *   post:
 *     summary: Envia e-mail diário do projeto
 *     tags: [InstallationProjects]
 *     security:
 *       - bearerAuth: []
 */
router.post(
  '/:id/emails/daily',
  auth(),
  requireLevel(2),
  auditAction({
    module: 'PROJETOS_INSTALACAO',
    action: 'EMAIL_DIARIO_ENVIADO',
    description: 'Enviou e-mail diário do projeto',
    entity: 'InstallationProject',
  }),
  ctrl.sendDailyEmail
);

/**
 * @swagger
 * /api/installation-projects/{id}/emails/final:
 *   post:
 *     summary: Envia e-mail final do projeto
 *     tags: [InstallationProjects]
 *     security:
 *       - bearerAuth: []
 */
router.post(
  '/:id/emails/final',
  auth(),
  requireLevel(2),
  auditAction({
    module: 'PROJETOS_INSTALACAO',
    action: 'EMAIL_FINAL_ENVIADO',
    description: 'Enviou e-mail final do projeto',
    entity: 'InstallationProject',
  }),
  ctrl.sendFinalEmail
);

module.exports = router;