const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const auth = require('../middleware/auth');
const requirePermission = require('../middleware/requirePermission');
const controller = require('../controllers/reverseController');

const router = express.Router();
const uploadDir = path.resolve(process.cwd(), 'uploads', 'reverse');
fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase();
    const name = `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
    cb(null, name);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 15 * 1024 * 1024, files: 20 },
  fileFilter: (_req, file, cb) => {
    const ok = /image\//.test(file.mimetype) || /pdf/.test(file.mimetype) || /octet-stream/.test(file.mimetype);
    cb(ok ? null : new Error('Arquivo inválido.'), ok);
  },
});

/**
 * @swagger
 * tags:
 *   name: Reversa
 *   description: Reversa mensal de equipamentos por prestador
 */

router.get('/public/:token', controller.publicGet);
router.post('/public/:token', upload.array('photos', 20), controller.publicSubmit);
router.post('/public/:token/partial', upload.array('photos', 20), controller.publicSavePartial);
router.get('/public/:token/chat', controller.publicListChatMessages);
router.post('/public/:token/chat', controller.publicSendChatMessage);

router.get('/config', auth(), requirePermission('REVERSE_VIEW'), controller.getConfig);
router.patch('/config', auth(), requirePermission('REVERSE_MANAGE'), controller.updateConfig);

router.get('/items', auth(), requirePermission('REVERSE_VIEW'), controller.listItems);
router.post('/items', auth(), requirePermission('REVERSE_ITEMS_MANAGE'), controller.createItem);
router.put('/items/:id', auth(), requirePermission('REVERSE_ITEMS_MANAGE'), controller.updateItem);
router.delete('/items/:id', auth(), requirePermission('REVERSE_ITEMS_MANAGE'), controller.deleteItem);

router.get('/providers', auth(), requirePermission('REVERSE_VIEW'), controller.listProviders);
router.patch('/providers/:id/toggle', auth(), requirePermission('REVERSE_MANAGE'), controller.toggleProvider);

router.get('/cycles', auth(), requirePermission('REVERSE_VIEW'), controller.listCycles);
router.post('/cycles', auth(), requirePermission('REVERSE_MANAGE'), controller.createCycle);
router.patch('/cycles/:id/close', auth(), requirePermission('REVERSE_MANAGE'), controller.closeCycle);
router.post('/cycles/:id/providers/sync', auth(), requirePermission('REVERSE_MANAGE'), controller.syncCycleProviders);
router.post('/cycles/:id/send-emails', auth(), requirePermission('REVERSE_SEND_EMAILS'), controller.sendCycleEmails);
router.post('/cycles/:id/send-reminders', auth(), requirePermission('REVERSE_SEND_EMAILS'), controller.sendReminderEmails);

router.get('/responses', auth(), requirePermission('REVERSE_VIEW'), controller.listResponses);
router.get('/responses/:id', auth(), requirePermission('REVERSE_VIEW'), controller.getResponse);
router.patch('/responses/:id/status', auth(), requirePermission('REVERSE_MANAGE'), controller.updateResponseStatus);
router.patch('/responses/:id/public-link', auth(), requirePermission('REVERSE_MANAGE'), controller.togglePublicLink);
router.patch('/responses/:id/chat-hidden', auth(), requirePermission('REVERSE_MANAGE'), controller.toggleChatHidden);
router.get('/responses/:id/chat', auth(), requirePermission('REVERSE_VIEW'), controller.listChatMessages);
router.post('/responses/:id/chat', auth(), requirePermission('REVERSE_MANAGE'), controller.sendChatMessage);

router.get('/transport-notes', auth(), requirePermission('REVERSE_VIEW'), controller.listTransportNotes);
router.post('/transport-notes', auth(), requirePermission('REVERSE_MANAGE'), upload.single('file'), controller.createTransportNote);
router.put('/transport-notes/:id', auth(), requirePermission('REVERSE_MANAGE'), upload.single('file'), controller.updateTransportNote);

router.post('/collection-requests', auth(), requirePermission('REVERSE_COLLECTION_MANAGE'), controller.createCollectionRequest);
router.post('/collection-requests/:id/send-email', auth(), requirePermission('REVERSE_COLLECTION_MANAGE'), controller.sendCollectionRequest);

module.exports = router;
