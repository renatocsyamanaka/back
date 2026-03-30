const router = require('express').Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const auth = require('../middleware/auth');
const requireLevel = require('../middleware/rbac');
const ctrl = require('../controllers/needAtaController');

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

const ataStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    const dir = path.join(process.cwd(), 'uploads', 'homologation', 'ata');
    ensureDir(dir);
    cb(null, dir);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname || '');
    const safeName = `${Date.now()}-${Math.random().toString(16).slice(2)}${ext}`;
    cb(null, safeName);
  },
});

const uploadAta = multer({
  storage: ataStorage,
  limits: { fileSize: 20 * 1024 * 1024 },
});

/**
 * INTERNO
 */
router.get('/needs/:needId', auth(), requireLevel(2), ctrl.getAtaSummary);
router.put('/needs/:needId/profile', auth(), requireLevel(2), ctrl.saveAtaProfile);
router.post(
  '/needs/:needId/document',
  auth(),
  requireLevel(2),
  uploadAta.single('file'),
  ctrl.uploadAtaDocument
);
router.delete(
  '/needs/:needId/document/:documentId',
  auth(),
  requireLevel(2),
  ctrl.deleteAtaDocument
);
router.post('/needs/:needId/submit', auth(), requireLevel(2), ctrl.submitAta);
router.post('/needs/:needId/review', auth(), requireLevel(2), ctrl.reviewAta);

module.exports = router;