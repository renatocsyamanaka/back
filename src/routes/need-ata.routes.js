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
/**
 * @swagger
 * /api/need-ata/needs/{needId}:
 *   get:
 *     summary: Consulta registros
 *     tags: [ATA de Needs]
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
router.get('/needs/:needId', auth(), requireLevel(2), ctrl.getAtaSummary);
/**
 * @swagger
 * /api/need-ata/needs/{needId}/profile:
 *   put:
 *     summary: Atualiza registro
 *     tags: [ATA de Needs]
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
router.put('/needs/:needId/profile', auth(), requireLevel(2), ctrl.saveAtaProfile);
/**
 * @swagger
 * /api/need-ata/needs/{needId}/document:
 *   post:
 *     summary: Cria ou executa ação
 *     tags: [ATA de Needs]
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
  '/needs/:needId/document',
  auth(),
  requireLevel(2),
  uploadAta.single('file'),
  ctrl.uploadAtaDocument
);
/**
 * @swagger
 * /api/need-ata/needs/{needId}/document/{documentId}:
 *   delete:
 *     summary: Remove registro
 *     tags: [ATA de Needs]
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
router.delete(
  '/needs/:needId/document/:documentId',
  auth(),
  requireLevel(2),
  ctrl.deleteAtaDocument
);
/**
 * @swagger
 * /api/need-ata/needs/{needId}/submit:
 *   post:
 *     summary: Cria ou executa ação
 *     tags: [ATA de Needs]
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
router.post('/needs/:needId/submit', auth(), requireLevel(2), ctrl.submitAta);
/**
 * @swagger
 * /api/need-ata/needs/{needId}/review:
 *   post:
 *     summary: Cria ou executa ação
 *     tags: [ATA de Needs]
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
router.post('/needs/:needId/review', auth(), requireLevel(2), ctrl.reviewAta);

module.exports = router;