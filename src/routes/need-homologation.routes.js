const router = require('express').Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const auth = require('../middleware/auth');
const requireLevel = require('../middleware/rbac');
const ctrl = require('../controllers/needHomologationController');

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

const templateStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    const dir = path.join(process.cwd(), 'uploads', 'homologation', 'templates');
    ensureDir(dir);
    cb(null, dir);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname || '');
    const safeName = `${Date.now()}-${Math.random().toString(16).slice(2)}${ext}`;
    cb(null, safeName);
  },
});

const registrationStorage = multer.diskStorage({
  destination: (req, _file, cb) => {
    const token = req.params.token || 'temp';
    const dir = path.join(process.cwd(), 'uploads', 'homologation', 'tmp', token);
    ensureDir(dir);
    cb(null, dir);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname || '');
    const safeName = `${Date.now()}-${Math.random().toString(16).slice(2)}${ext}`;
    cb(null, safeName);
  },
});

const internalAdditionalStorage = multer.diskStorage({
  destination: (req, _file, cb) => {
    const needId = req.params.needId || 'temp';
    const dir = path.join(process.cwd(), 'uploads', 'homologation', 'internal', String(needId));
    ensureDir(dir);
    cb(null, dir);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname || '');
    const safeName = `${Date.now()}-${Math.random().toString(16).slice(2)}${ext}`;
    cb(null, safeName);
  },
});

const uploadTemplate = multer({
  storage: templateStorage,
  limits: { fileSize: 20 * 1024 * 1024 },
});

const uploadRegistration = multer({
  storage: registrationStorage,
  limits: { fileSize: 20 * 1024 * 1024 },
});

const uploadInternalAdditional = multer({
  storage: internalAdditionalStorage,
  limits: { fileSize: 20 * 1024 * 1024 },
});

/**
 * TIPOS DE DOCUMENTO
 */
/**
 * @swagger
 * /api/need-homologation/document-types:
 *   get:
 *     summary: Consulta registros
 *     tags: [Homologação de Needs]
 *     security:
 *       - bearerAuth: []
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
router.get('/document-types', auth(), ctrl.listDocumentTypes);
/**
 * @swagger
 * /api/need-homologation/document-types:
 *   post:
 *     summary: Cria ou executa ação
 *     tags: [Homologação de Needs]
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
router.post('/document-types', auth(), requireLevel(2), ctrl.createDocumentType);
/**
 * @swagger
 * /api/need-homologation/document-types/{documentTypeId}:
 *   put:
 *     summary: Atualiza registro
 *     tags: [Homologação de Needs]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: documentTypeId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Identificador documentTypeId
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
router.put('/document-types/:documentTypeId', auth(), requireLevel(2), ctrl.updateDocumentType);
/**
 * @swagger
 * /api/need-homologation/document-types/seed-defaults:
 *   post:
 *     summary: Cria ou executa ação
 *     tags: [Homologação de Needs]
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
router.post('/document-types/seed-defaults', auth(), requireLevel(2), ctrl.seedDefaultDocumentTypes);

/**
 * @swagger
 * /api/need-homologation/document-types/{documentTypeId}/template:
 *   post:
 *     summary: Cria ou executa ação
 *     tags: [Homologação de Needs]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: documentTypeId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Identificador documentTypeId
 *     requestBody:
 *       required: false
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
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
router.post(
  '/document-types/:documentTypeId/template',
  auth(),
  requireLevel(2),
  uploadTemplate.single('file'),
  ctrl.uploadDocumentTypeTemplate
);

/**
 * INTERNO
 */
/**
 * @swagger
 * /api/need-homologation/needs/{needId}:
 *   get:
 *     summary: Consulta registros
 *     tags: [Homologação de Needs]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: needId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Identificador needId
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
router.get('/needs/:needId', auth(), requireLevel(2), ctrl.getInternalSummary);
/**
 * @swagger
 * /api/need-homologation/needs/{needId}/invites:
 *   get:
 *     summary: Consulta registros
 *     tags: [Homologação de Needs]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: needId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Identificador needId
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
router.get('/needs/:needId/invites', auth(), requireLevel(2), ctrl.listInvites);
/**
 * @swagger
 * /api/need-homologation/needs/{needId}/invites:
 *   post:
 *     summary: Cria ou executa ação
 *     tags: [Homologação de Needs]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: needId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Identificador needId
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
router.post('/needs/:needId/invites', auth(), requireLevel(2), ctrl.createInvite);
/**
 * @swagger
 * /api/need-homologation/needs/{needId}/send-finance:
 *   post:
 *     summary: Cria ou executa ação
 *     tags: [Homologação de Needs]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: needId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Identificador needId
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
router.post('/needs/:needId/send-finance', auth(), ctrl.sendToFinance);
/**
 * @swagger
 * /api/need-homologation/needs/{needId}/invites/{inviteId}/cancel:
 *   patch:
 *     summary: Atualiza parcialmente registro
 *     tags: [Homologação de Needs]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: needId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Identificador needId
 *       - in: path
 *         name: inviteId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Identificador inviteId
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
router.patch('/needs/:needId/invites/:inviteId/cancel', auth(), requireLevel(2), ctrl.cancelInvite);
/**
 * @swagger
 * /api/need-homologation/needs/{needId}/review:
 *   patch:
 *     summary: Atualiza parcialmente registro
 *     tags: [Homologação de Needs]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: needId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Identificador needId
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
router.patch('/needs/:needId/review', auth(), requireLevel(2), ctrl.reviewRegistration);
/**
 * @swagger
 * /api/need-homologation/documents/{documentId}/review:
 *   patch:
 *     summary: Atualiza parcialmente registro
 *     tags: [Homologação de Needs]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: documentId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Identificador documentId
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
router.patch('/documents/:documentId/review', auth(), requireLevel(2), ctrl.reviewDocument);
/**
 * @swagger
 * /api/need-homologation/documents/{documentId}:
 *   delete:
 *     summary: Remove registro
 *     tags: [Homologação de Needs]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: documentId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Identificador documentId
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
router.delete('/documents/:documentId', auth(), requireLevel(2), ctrl.deleteRegistrationDocument);
/**
 * @swagger
 * /api/need-homologation/invites/{inviteId}/resend-email:
 *   post:
 *     summary: Cria ou executa ação
 *     tags: [Homologação de Needs]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: inviteId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Identificador inviteId
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
router.post('/invites/:inviteId/resend-email', auth(), requireLevel(2), ctrl.resendInviteEmail);

/**
 * @swagger
 * /api/need-homologation/needs/{needId}/internal-documents:
 *   post:
 *     summary: Cria ou executa ação
 *     tags: [Homologação de Needs]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: needId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Identificador needId
 *     requestBody:
 *       required: false
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
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
router.post(
  '/needs/:needId/internal-documents',
  auth(),
  requireLevel(2),
  uploadInternalAdditional.single('file'),
  ctrl.uploadInternalDocument
);

/**
 * PRESTADORES APROVADOS
 */
/**
 * @swagger
 * /api/need-homologation/approved:
 *   get:
 *     summary: Consulta registros
 *     tags: [Homologação de Needs]
 *     security:
 *       - bearerAuth: []
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
router.get('/approved', auth(), requireLevel(2), ctrl.listApprovedRegistrations);
/**
 * @swagger
 * /api/need-homologation/approved/export/csv:
 *   get:
 *     summary: Consulta registros
 *     tags: [Homologação de Needs]
 *     security:
 *       - bearerAuth: []
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
router.get('/approved/export/csv', auth(), requireLevel(2), ctrl.exportApprovedRegistrationsCsv);
/**
 * @swagger
 * /api/need-homologation/approved/{registrationId}:
 *   get:
 *     summary: Consulta registros
 *     tags: [Homologação de Needs]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: registrationId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Identificador registrationId
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
router.get('/approved/:registrationId', auth(), requireLevel(2), ctrl.getApprovedRegistrationDetail);
/**
 * @swagger
 * /api/need-homologation/approved/{registrationId}/documents:
 *   get:
 *     summary: Consulta registros
 *     tags: [Homologação de Needs]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: registrationId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Identificador registrationId
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
router.get('/approved/:registrationId/documents', auth(), requireLevel(2), ctrl.listApprovedRegistrationDocuments);

/**
 * @swagger
 * /api/need-homologation/approved/{registrationId}/documents/download-zip:
 *   get:
 *     summary: Consulta registros
 *     tags: [Homologação de Needs]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: registrationId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Identificador registrationId
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
router.get(
  '/approved/:registrationId/documents/download-zip',
  auth(),
  requireLevel(2),
  (req, res) => ctrl.downloadApprovedRegistrationDocumentsZip(req, res)
);

/**
 * @swagger
 * /api/need-homologation/approved/{registrationId}/documents/{documentId}/view:
 *   get:
 *     summary: Consulta registros
 *     tags: [Homologação de Needs]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: registrationId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Identificador registrationId
 *       - in: path
 *         name: documentId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Identificador documentId
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
router.get(
  '/approved/:registrationId/documents/:documentId/view',
  auth(),
  requireLevel(2),
  ctrl.viewApprovedRegistrationDocument
);

/**
 * @swagger
 * /api/need-homologation/approved/{registrationId}/documents/{documentId}/download:
 *   get:
 *     summary: Consulta registros
 *     tags: [Homologação de Needs]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: registrationId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Identificador registrationId
 *       - in: path
 *         name: documentId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Identificador documentId
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
router.get(
  '/approved/:registrationId/documents/:documentId/download',
  auth(),
  requireLevel(2),
  ctrl.downloadApprovedRegistrationDocument
);

/**
 * PÚBLICO
 */
/**
 * @swagger
 * /api/need-homologation/public/{token}:
 *   get:
 *     summary: Consulta registros
 *     tags: [Homologação de Needs]
 *     parameters:
 *       - in: path
 *         name: token
 *         required: true
 *         schema:
 *           type: integer
 *         description: Identificador token
 *     responses:
 *       200:
 *         description: Operação realizada com sucesso
 *       400:
 *         description: Requisição inválida
 *       404:
 *         description: Registro não encontrado
 *       500:
 *         description: Erro interno
 */
router.get('/public/:token', ctrl.publicOpen);
/**
 * @swagger
 * /api/need-homologation/public/{token}/draft:
 *   patch:
 *     summary: Atualiza parcialmente registro
 *     tags: [Homologação de Needs]
 *     parameters:
 *       - in: path
 *         name: token
 *         required: true
 *         schema:
 *           type: integer
 *         description: Identificador token
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
 *       404:
 *         description: Registro não encontrado
 *       500:
 *         description: Erro interno
 */
router.patch('/public/:token/draft', ctrl.publicSaveDraft);

/**
 * @swagger
 * /api/need-homologation/public/{token}/documents:
 *   post:
 *     summary: Cria ou executa ação
 *     tags: [Homologação de Needs]
 *     parameters:
 *       - in: path
 *         name: token
 *         required: true
 *         schema:
 *           type: integer
 *         description: Identificador token
 *     requestBody:
 *       required: false
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: Operação realizada com sucesso
 *       201:
 *         description: Registro criado com sucesso
 *       400:
 *         description: Requisição inválida
 *       404:
 *         description: Registro não encontrado
 *       500:
 *         description: Erro interno
 */
router.post(
  '/public/:token/documents',
  uploadRegistration.single('file'),
  ctrl.publicUploadDocument
);

/**
 * @swagger
 * /api/need-homologation/public/{token}/documents/{documentId}:
 *   delete:
 *     summary: Remove registro
 *     tags: [Homologação de Needs]
 *     parameters:
 *       - in: path
 *         name: token
 *         required: true
 *         schema:
 *           type: integer
 *         description: Identificador token
 *       - in: path
 *         name: documentId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Identificador documentId
 *     responses:
 *       200:
 *         description: Operação realizada com sucesso
 *       400:
 *         description: Requisição inválida
 *       404:
 *         description: Registro não encontrado
 *       500:
 *         description: Erro interno
 */
router.delete('/public/:token/documents/:documentId', ctrl.publicDeleteDocument);
/**
 * @swagger
 * /api/need-homologation/public/{token}/submit:
 *   post:
 *     summary: Cria ou executa ação
 *     tags: [Homologação de Needs]
 *     parameters:
 *       - in: path
 *         name: token
 *         required: true
 *         schema:
 *           type: integer
 *         description: Identificador token
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
 *       404:
 *         description: Registro não encontrado
 *       500:
 *         description: Erro interno
 */
router.post('/public/:token/submit', ctrl.publicSubmit);

module.exports = router;