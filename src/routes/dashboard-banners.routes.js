const router = require('express').Router();
const auth = require('../middleware/auth');
const requireLevel = require('../middleware/rbac');
const ctrl = require('../controllers/dashboardBannerController');

const multer = require('multer');
const path = require('path');
const fs = require('fs');

function ensureDir(p) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    const dir = path.join(process.cwd(), 'uploads', 'dashboard-banners');
    ensureDir(dir);
    cb(null, dir);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname || '');
    const safe = `${Date.now()}-${Math.random().toString(16).slice(2)}${ext}`;
    cb(null, safe);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 8 * 1024 * 1024 },
});

router.use(auth());

router.get('/', ctrl.list);
router.get('/:id', ctrl.getById);

router.post('/', requireLevel(2), ctrl.create);
router.patch('/:id', requireLevel(2), ctrl.update);
router.delete('/:id', requireLevel(2), ctrl.remove);
router.post('/:id/restore', requireLevel(2), ctrl.restore);
router.post('/:id/image', requireLevel(2), upload.single('image'), ctrl.uploadImage);

module.exports = router;