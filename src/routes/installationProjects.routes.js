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
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID do projeto
 *         example: 1
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [recordType]
 *             properties:
 *               recordType:
 *                 type: string
 *                 enum: [PROJECT, BASE, OUTROS]
 *                 example: PROJECT
 *     responses:
 *       200:
 *         description: Tipo de registro alterado com sucesso
 *       400:
 *         description: Dados inválidos
 *       401:
 *         description: Não autorizado
 *       404:
 *         description: Projeto não encontrado
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
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID da base/projeto
 *         example: 1
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title:
 *                 type: string
 *                 example: Projeto convertido Cliente XPTO
 *               contactEmails:
 *                 type: array
 *                 items:
 *                   type: string
 *                 example: ["cliente@empresa.com.br"]
 *               trucksTotal:
 *                 type: integer
 *                 example: 100
 *               equipmentsPerDay:
 *                 type: integer
 *                 example: 10
 *     responses:
 *       200:
 *         description: Base convertida com sucesso
 *       401:
 *         description: Não autorizado
 *       404:
 *         description: Registro não encontrado
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
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID do projeto
 *         example: 1
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               whatsappGroupName:
 *                 type: string
 *                 example: Grupo Cliente XPTO
 *               whatsappGroupLink:
 *                 type: string
 *                 example: https://chat.whatsapp.com/exemplo
 *     responses:
 *       200:
 *         description: Dados de WhatsApp atualizados com sucesso
 *       401:
 *         description: Não autorizado
 *       404:
 *         description: Projeto não encontrado
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
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID do projeto
 *         example: 1
 *     responses:
 *       200:
 *         description: Projeto iniciado com sucesso
 *       401:
 *         description: Não autorizado
 *       404:
 *         description: Projeto não encontrado
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
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID do projeto
 *         example: 1
 *     responses:
 *       200:
 *         description: Projeto finalizado com sucesso
 *       401:
 *         description: Não autorizado
 *       404:
 *         description: Projeto não encontrado
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
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID do projeto
 *         example: 1
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
 *                 description: Logo PNG ou JPG
 *     responses:
 *       200:
 *         description: Logo enviada com sucesso
 *       400:
 *         description: Arquivo inválido
 *       401:
 *         description: Não autorizado
 *       404:
 *         description: Projeto não encontrado
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
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID do projeto
 *         example: 1
 *     responses:
 *       200:
 *         description: Logo excluída com sucesso
 *       401:
 *         description: Não autorizado
 *       404:
 *         description: Projeto não encontrado
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
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID do projeto
 *         example: 1
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, quantity]
 *             properties:
 *               name:
 *                 type: string
 *                 example: OMNITURBO
 *               quantity:
 *                 type: integer
 *                 example: 50
 *     responses:
 *       201:
 *         description: Item criado com sucesso
 *       400:
 *         description: Dados inválidos
 *       401:
 *         description: Não autorizado
 *       404:
 *         description: Projeto não encontrado
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
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID do projeto
 *         example: 1
 *       - in: path
 *         name: itemId
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID do item
 *         example: 10
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 example: OMNITURBO
 *               quantity:
 *                 type: integer
 *                 example: 60
 *     responses:
 *       200:
 *         description: Item atualizado com sucesso
 *       400:
 *         description: Dados inválidos
 *       401:
 *         description: Não autorizado
 *       404:
 *         description: Item ou projeto não encontrado
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
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID do projeto
 *         example: 1
 *       - in: path
 *         name: itemId
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID do item
 *         example: 10
 *     responses:
 *       200:
 *         description: Item excluído com sucesso
 *       401:
 *         description: Não autorizado
 *       404:
 *         description: Item ou projeto não encontrado
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


router.post(
  '/:id/accessories',
  auth(),
  requireLevel(2),
  auditAction({
    module: 'PROJETOS_INSTALACAO',
    action: 'ACESSORIO_CRIADO',
    description: 'Adicionou acessório ao projeto de instalação',
    entity: 'InstallationProjectAccessory',
  }),
  ctrl.addAccessory
);

router.put(
  '/:id/accessories/:accessoryId',
  auth(),
  requireLevel(2),
  auditAction({
    module: 'PROJETOS_INSTALACAO',
    action: 'ACESSORIO_ATUALIZADO',
    description: 'Atualizou acessório do projeto de instalação',
    entity: 'InstallationProjectAccessory',
  }),
  ctrl.updateAccessory
);

router.delete(
  '/:id/accessories/:accessoryId',
  auth(),
  requireLevel(2),
  auditAction({
    module: 'PROJETOS_INSTALACAO',
    action: 'ACESSORIO_EXCLUIDO',
    description: 'Excluiu acessório do projeto de instalação',
    entity: 'InstallationProjectAccessory',
  }),
  ctrl.removeAccessory
);

/**
 * @swagger
 * /api/installation-projects/{id}/progress:
 *   post:
 *     summary: Lança progresso no projeto
 *     tags: [InstallationProjects]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID do projeto
 *         example: 1
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               date:
 *                 type: string
 *                 format: date
 *                 example: 2026-05-04
 *               trucksDoneToday:
 *                 type: integer
 *                 example: 5
 *               notes:
 *                 type: string
 *                 example: Progresso lançado pelo Swagger
 *               vehicles:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     plate:
 *                       type: string
 *                       example: ABC1D23
 *                     serial:
 *                       type: string
 *                       example: SN123456
 *     responses:
 *       201:
 *         description: Progresso lançado com sucesso
 *       400:
 *         description: Dados inválidos
 *       401:
 *         description: Não autorizado
 *       404:
 *         description: Projeto não encontrado
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
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID do projeto
 *         example: 1
 *       - in: path
 *         name: progressId
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID do progresso
 *         example: 20
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               date:
 *                 type: string
 *                 format: date
 *                 example: 2026-05-04
 *               trucksDoneToday:
 *                 type: integer
 *                 example: 8
 *               notes:
 *                 type: string
 *                 example: Progresso atualizado
 *     responses:
 *       200:
 *         description: Progresso atualizado com sucesso
 *       400:
 *         description: Dados inválidos
 *       401:
 *         description: Não autorizado
 *       404:
 *         description: Progresso ou projeto não encontrado
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
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID do projeto
 *         example: 1
 *       - in: path
 *         name: progressId
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID do progresso
 *         example: 20
 *     responses:
 *       200:
 *         description: Progresso excluído com sucesso
 *       401:
 *         description: Não autorizado
 *       404:
 *         description: Progresso ou projeto não encontrado
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
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID do projeto
 *         example: 1
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               dailyReportEnabled:
 *                 type: boolean
 *                 example: true
 *               dailyReportSendToClient:
 *                 type: boolean
 *                 example: false
 *               dailyReportType:
 *                 type: string
 *                 example: complete
 *               dailyReportHeaderColor:
 *                 type: string
 *                 example: "#005BAA"
 *               dailyReportColorDone:
 *                 type: string
 *                 example: "#52c41a"
 *               dailyReportColorPending:
 *                 type: string
 *                 example: "#faad14"
 *               contactEmails:
 *                 type: array
 *                 items:
 *                   type: string
 *                 example: ["cliente@empresa.com.br"]
 *     responses:
 *       200:
 *         description: Configurações atualizadas com sucesso
 *       400:
 *         description: Dados inválidos
 *       401:
 *         description: Não autorizado
 *       404:
 *         description: Projeto não encontrado
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
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID do projeto
 *         example: 1
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               date:
 *                 type: string
 *                 format: date
 *                 example: 2026-05-04
 *               sendAll:
 *                 type: boolean
 *                 example: false
 *               emailTo:
 *                 type: array
 *                 items:
 *                   type: string
 *                 example: ["renato.yamanaka@omnilink.com.br"]
 *               reportType:
 *                 type: string
 *                 example: complete
 *     responses:
 *       200:
 *         description: Relatório enviado com sucesso
 *       400:
 *         description: Dados inválidos
 *       401:
 *         description: Não autorizado
 *       404:
 *         description: Projeto não encontrado
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
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID do projeto
 *         example: 1
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               emailTo:
 *                 type: array
 *                 items:
 *                   type: string
 *                 example: ["cliente@empresa.com.br"]
 *               sendAll:
 *                 type: boolean
 *                 example: false
 *     responses:
 *       200:
 *         description: E-mail inicial enviado com sucesso
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
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID do projeto
 *         example: 1
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               date:
 *                 type: string
 *                 format: date
 *                 example: 2026-05-04
 *               emailTo:
 *                 type: array
 *                 items:
 *                   type: string
 *                 example: ["cliente@empresa.com.br"]
 *               sendAll:
 *                 type: boolean
 *                 example: false
 *               reportType:
 *                 type: string
 *                 example: complete
 *     responses:
 *       200:
 *         description: E-mail diário enviado com sucesso
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
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID do projeto
 *         example: 1
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               emailTo:
 *                 type: array
 *                 items:
 *                   type: string
 *                 example: ["cliente@empresa.com.br"]
 *               sendAll:
 *                 type: boolean
 *                 example: false
 *     responses:
 *       200:
 *         description: E-mail final enviado com sucesso
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