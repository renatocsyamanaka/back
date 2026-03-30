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

const uploadTemplate = multer({
  storage: templateStorage,
  limits: { fileSize: 20 * 1024 * 1024 },
});

const uploadRegistration = multer({
  storage: registrationStorage,
  limits: { fileSize: 20 * 1024 * 1024 },
});

/**
 * TIPOS DE DOCUMENTO
 */
router.get('/document-types', auth(), ctrl.listDocumentTypes);
router.post('/document-types', auth(), requireLevel(2), ctrl.createDocumentType);
router.put('/document-types/:documentTypeId', auth(), requireLevel(2), ctrl.updateDocumentType);
router.post('/document-types/seed-defaults', auth(), requireLevel(2), ctrl.seedDefaultDocumentTypes);
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
router.get('/needs/:needId', auth(), requireLevel(2), ctrl.getInternalSummary);
router.get('/needs/:needId/invites', auth(), requireLevel(2), ctrl.listInvites);
router.post('/needs/:needId/invites', auth(), requireLevel(2), ctrl.createInvite);
router.patch('/needs/:needId/invites/:inviteId/cancel', auth(), requireLevel(2), ctrl.cancelInvite);
router.patch('/needs/:needId/review', auth(), requireLevel(2), ctrl.reviewRegistration);
router.patch('/documents/:documentId/review', auth(), requireLevel(2), ctrl.reviewDocument);
router.delete('/documents/:documentId', auth(), requireLevel(2), ctrl.deleteRegistrationDocument);
router.post('/invites/:inviteId/resend-email',  auth(), requireLevel(2),  ctrl.resendInviteEmail);

/**
 * PÚBLICO
 */
router.get('/public/:token', ctrl.publicOpen);
router.patch('/public/:token/draft', ctrl.publicSaveDraft);
router.post(
  '/public/:token/documents',
  uploadRegistration.single('file'),
  ctrl.publicUploadDocument
);
router.delete('/public/:token/documents/:documentId', ctrl.publicDeleteDocument);
router.post('/public/:token/submit', ctrl.publicSubmit);

module.exports = router;