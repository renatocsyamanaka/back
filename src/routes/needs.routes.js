const router = require('express').Router();
const auth = require('../middleware/auth');
const requireLevel = require('../middleware/rbac');
const ctrl = require('../controllers/needController');

// ✅ anexos (multer + model)
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { Need, NeedAttachment } = require('../models');

/**
 * @swagger
 * tags:
 *   name: Needs
 *   description: Requisições de técnicos por localidade (inclui captação/homologação e anexos)
 */

/** =========================
 *  Helpers uploads
 *  ========================= */
function ensureDir(p) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, _file, cb) => {
    const needId = req.params.id;
    const dir = path.join(process.cwd(), 'uploads', 'needs', String(needId));
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
  limits: { fileSize: 15 * 1024 * 1024 }, // 15MB
});

/**
 * @swagger
 * /api/needs:
 *   post:
 *     summary: Cria uma requisição de técnico
 *     tags: [Needs]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [requestedLocationText]
 *             properties:
 *               requestedLocationText: { type: string, example: "Av. Paulista, 1000 - São Paulo/SP" }
 *               requestedCity: { type: string, nullable: true }
 *               requestedState: { type: string, nullable: true }
 *               requestedCep: { type: string, nullable: true }
 *               requestedLat: { type: number, nullable: true }
 *               requestedLng: { type: number, nullable: true }
 *               requestedName: { type: string, example: "Técnico a definir" }
 *               techTypeId: { type: number, nullable: true }
 *               notes: { type: string, nullable: true }
 *   get:
 *     summary: Lista requisições
 *     tags: [Needs]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: status
 *         schema: { type: string, example: "OPEN" }
 *       - in: query
 *         name: techTypeId
 *         schema: { type: number }
 *       - in: query
 *         name: requesterId
 *         schema: { type: number }
 *       - in: query
 *         name: q
 *         schema: { type: string }
 */
router.post('/', auth(), requireLevel(2), ctrl.create);
router.get('/', auth(), ctrl.list);

/**
 * @swagger
 * /api/needs/requesters:
 *   get:
 *     summary: Lista solicitantes (para preencher o select do filtro)
 *     tags: [Needs]
 *     security: [{ bearerAuth: [] }]
 */
router.get('/requesters', auth(), ctrl.requesters);

/**
 * @swagger
 * /api/needs/{id}/status:
 *   patch:
 *     summary: Atualiza status da requisição
 *     tags: [Needs]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: number }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [status]
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [OPEN, IN_PROGRESS, FULFILLED, CANCELLED]
 */
router.patch('/:id/status', auth(), requireLevel(2), ctrl.updateStatus);

/**
 * @swagger
 * /api/needs/{id}/provider:
 *   patch:
 *     summary: Atualiza dados do prestador (captação/homologação)
 *     tags: [Needs]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: number }
 */
router.patch('/:id/provider', auth(), requireLevel(2), ctrl.updateProvider);

/**
 * @swagger
 * /api/needs/{id}/address:
 *   patch:
 *     summary: Atualiza endereço e coordenadas (lat/lng)
 *     tags: [Needs]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: number }
 */
router.patch('/:id/address', auth(), requireLevel(2), ctrl.updateAddress);

/** =========================
 *  ✅ ANEXOS
 *  ========================= */

/**
 * @swagger
 * /api/needs/{id}/attachments:
 *   get:
 *     summary: Lista anexos da Need
 *     tags: [Needs]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: number }
 */
router.get('/:id/attachments', auth(), async (req, res) => {
  try {
    const needId = Number(req.params.id);
    const rows = await NeedAttachment.findAll({
      where: { needId },
      order: [['createdAt', 'DESC']],
    });
    return res.json(rows);
  } catch (e) {
    console.error('[needs.attachments.list]', e);
    return res.status(500).json({ error: 'Falha ao listar anexos' });
  }
});

/**
 * @swagger
 * /api/needs/{id}/attachments:
 *   post:
 *     summary: Anexa um arquivo na Need
 *     tags: [Needs]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: number }
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [file]
 *             properties:
 *               kind:
 *                 type: string
 *                 enum: [CONTRATO, DOCUMENTO, FOTO, OUTRO]
 *                 example: DOCUMENTO
 *               file:
 *                 type: string
 *                 format: binary
 */
router.post('/:id/attachments', auth(), requireLevel(2), upload.single('file'), async (req, res) => {
  try {
    const needId = Number(req.params.id);

    const need = await Need.findByPk(needId);
    if (!need) return res.status(404).json({ error: 'Need não encontrada' });

    if (!req.file) return res.status(400).json({ error: 'Arquivo não enviado (campo "file")' });

    const kind = String(req.body?.kind || 'DOCUMENTO').toUpperCase();
    const allowed = ['CONTRATO', 'DOCUMENTO', 'FOTO', 'OUTRO'];
    if (!allowed.includes(kind)) return res.status(400).json({ error: 'kind inválido' });

    // ✅ melhor guardar URL RELATIVA (facilita prod/homolog sem BASE_URL)
    const url = `/uploads/needs/${needId}/${req.file.filename}`;

    const row = await NeedAttachment.create({
      needId,
      kind,
      originalName: req.file.originalname,
      fileName: req.file.filename,
      mimeType: req.file.mimetype,
      size: req.file.size,
      url,
      uploadedById: req.user?.id || null,
    });

    return res.json(row);
  } catch (e) {
    console.error('[needs.attachments.upload]', e);
    return res.status(500).json({ error: 'Falha ao anexar arquivo' });
  }
});

/**
 * @swagger
 * /api/needs/{id}/attachments/{attachmentId}:
 *   delete:
 *     summary: Remove um anexo da Need
 *     tags: [Needs]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: number }
 *       - in: path
 *         name: attachmentId
 *         required: true
 *         schema: { type: number }
 */
router.delete('/:id/attachments/:attachmentId', auth(), requireLevel(2), async (req, res) => {
  try {
    const needId = Number(req.params.id);
    const attachmentId = Number(req.params.attachmentId);

    const row = await NeedAttachment.findOne({ where: { id: attachmentId, needId } });
    if (!row) return res.status(404).json({ error: 'Anexo não encontrado' });

    // remove do disco (best effort)
    try {
      const pathname = row.url || `/uploads/needs/${needId}/${row.fileName}`;
      const rel = pathname.replace(/^\/+/, '');
      const filePath = path.resolve(process.cwd(), rel);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    } catch (err) {
      console.warn('[needs.attachments.delete] falha ao apagar arquivo:', err?.message);
    }

    await row.destroy();
    return res.json({ ok: true });
  } catch (e) {
    console.error('[needs.attachments.delete]', e);
    return res.status(500).json({ error: 'Falha ao remover anexo' });
  }
});

module.exports = router;
