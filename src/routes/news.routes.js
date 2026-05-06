const router = require('express').Router();
const auth = require('../middleware/auth');
const requireLevel = require('../middleware/rbac');
const ctrl = require('../controllers/newsController');

const multer = require('multer');
const path = require('path');
const fs = require('fs');

function ensureDir(p) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
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
  limits: { fileSize: 8 * 1024 * 1024 },
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
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *         example: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *         example: 10
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         example: "portal"
 *     responses:
 *       200:
 *         description: Lista de notícias retornada com sucesso
 */
router.get('/', auth(), ctrl.list);

/**
 * @swagger
 * /api/news/{id}:
 *   get:
 *     summary: Detalhar notícia
 *     tags: [News]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID da notícia
 *         example: 1
 *     responses:
 *       200:
 *         description: Notícia encontrada
 *       404:
 *         description: Notícia não encontrada
 */
router.get('/:id', auth(), ctrl.getById);

/**
 * @swagger
 * /api/news:
 *   post:
 *     summary: Criar notícia
 *     tags: [News]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - title
 *               - content
 *             properties:
 *               title:
 *                 type: string
 *                 example: "Nova atualização do portal"
 *               content:
 *                 type: string
 *                 example: "Publicamos uma nova atualização com melhorias no sistema."
 *               summary:
 *                 type: string
 *                 example: "Resumo da notícia"
 *               active:
 *                 type: boolean
 *                 example: true
 *     responses:
 *       201:
 *         description: Notícia criada com sucesso
 *       400:
 *         description: Dados inválidos
 */
router.post('/', auth(), requireLevel(2), ctrl.create);

/**
 * @swagger
 * /api/news/{id}:
 *   patch:
 *     summary: Editar notícia
 *     tags: [News]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID da notícia
 *         example: 1
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title:
 *                 type: string
 *                 example: "Título atualizado"
 *               content:
 *                 type: string
 *                 example: "Conteúdo atualizado da notícia."
 *               summary:
 *                 type: string
 *                 example: "Resumo atualizado"
 *               active:
 *                 type: boolean
 *                 example: true
 *     responses:
 *       200:
 *         description: Notícia atualizada com sucesso
 *       404:
 *         description: Notícia não encontrada
 */
router.patch('/:id', auth(), requireLevel(2), ctrl.update);

/**
 * @swagger
 * /api/news/{id}:
 *   delete:
 *     summary: Remover notícia
 *     tags: [News]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID da notícia
 *         example: 1
 *     responses:
 *       200:
 *         description: Notícia removida com sucesso
 *       404:
 *         description: Notícia não encontrada
 */
router.delete('/:id', auth(), requireLevel(2), ctrl.remove);

/**
 * @swagger
 * /api/news/{id}/image:
 *   post:
 *     summary: Upload de imagem da notícia
 *     tags: [News]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID da notícia
 *         example: 1
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - image
 *             properties:
 *               image:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: Imagem enviada com sucesso
 *       400:
 *         description: Arquivo inválido
 *       404:
 *         description: Notícia não encontrada
 */
router.post('/:id/image', auth(), requireLevel(2), upload.single('image'), ctrl.uploadImage);

module.exports = router;