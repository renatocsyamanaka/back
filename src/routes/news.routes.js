const router = require('express').Router();
const auth = require('../middleware/auth');
const requireLevel = require('../middleware/rbac');
const ctrl = require('../controllers/newsController');

// Upload (opcional) para imagem da notícia
const multer = require('multer');
const path = require('path');
const fs = require('fs');

function ensureDir(p) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, _file, cb) => {
    const dir = path.join(process.cwd(), 'uploads', 'news');
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
  limits: { fileSize: 8 * 1024 * 1024 }, // 8MB
});

/**
 * @swagger
 * tags:
 *   name: News
 *   description: Notícias do sistema
 */

/**
 * @swagger
 * /api/news:
 *   get:
 *     summary: Listar notícias
 *     tags: [News]
 *     security: [{ bearerAuth: [] }]
 */
router.get('/', auth(), ctrl.list);

/**
 * @swagger
 * /api/news/{id}:
 *   get:
 *     summary: Detalhar notícia
 *     tags: [News]
 *     security: [{ bearerAuth: [] }]
 */
router.get('/:id', auth(), ctrl.getById);

/**
 * @swagger
 * /api/news:
 *   post:
 *     summary: Criar notícia
 *     tags: [News]
 *     security: [{ bearerAuth: [] }]
 */
router.post('/', auth(), requireLevel(2), ctrl.create);

/**
 * @swagger
 * /api/news/{id}:
 *   patch:
 *     summary: Editar notícia
 *     tags: [News]
 *     security: [{ bearerAuth: [] }]
 */
router.patch('/:id', auth(), requireLevel(2), ctrl.update);

/**
 * @swagger
 * /api/news/{id}:
 *   delete:
 *     summary: Remover notícia
 *     tags: [News]
 *     security: [{ bearerAuth: [] }]
 */
router.delete('/:id', auth(), requireLevel(2), ctrl.remove);

/**
 * @swagger
 * /api/news/{id}/image:
 *   post:
 *     summary: Upload de imagem da notícia
 *     tags: [News]
 *     security: [{ bearerAuth: [] }]
 */
router.post('/:id/image', auth(), requireLevel(2), upload.single('image'), ctrl.uploadImage);

module.exports = router;
