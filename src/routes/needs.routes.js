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
 *   description: Requisições de técnicos por localidade
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
 *     summary: Solicita um técnico para uma localidade
 *     description: Cria uma requisição (status inicial OPEN) vinculada a um local. Você pode informar qualquer nome para o técnico solicitado.
 *     tags: [Needs]
 *     security: [ { bearerAuth: [] } ]
 */
router.post('/', auth(), requireLevel(2), ctrl.create);

/**
 * @swagger
 * /api/needs:
 *   get:
 *     summary: Lista requisições de técnicos
 *     tags: [Needs]
 *     security: [ { bearerAuth: [] } ]
 */
router.get('/', auth(), ctrl.list);

/**
 * @swagger
 * /api/needs/{id}/status:
 *   patch:
 *     summary: Atualiza status da requisição
 *     tags: [Needs]
 *     security: [ { bearerAuth: [] } ]
 */
router.patch('/:id/status', auth(), requireLevel(2), ctrl.updateStatus);

/**
 * @swagger
 * /api/needs/{id}/provider:
 *   patch:
 *     summary: Atualiza dados do prestador em captação/homologação
 *     tags: [Needs]
 *     security: [ { bearerAuth: [] } ]
 */
router.patch('/:id/provider', auth(), requireLevel(2), ctrl.updateProvider);

// ✅ editar endereço
router.patch('/:id/address', auth(), ctrl.updateAddress);

// ✅ opcional pro select do solicitante
router.get('/requesters', auth(), ctrl.requesters);

/** =========================
 *  ✅ ANEXOS
 *  ========================= */

/**
 * GET /api/needs/:id/attachments
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
 * POST /api/needs/:id/attachments
 * multipart/form-data:
 * - file: arquivo
 * - kind: CONTRATO | DOCUMENTO | FOTO | OUTRO
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

    const BASE_URL = process.env.BASE_URL || 'https://api.projetos-rc.online/api';
    const url = `${BASE_URL}/uploads/needs/${needId}/${req.file.filename}`;

    const row = await NeedAttachment.create({
      needId,
      kind,
      originalName: req.file.originalname,
      fileName: req.file.filename,
      mimeType: req.file.mimetype,
      size: req.file.size,
      url,
      uploadedById: req.user?.id || null, // se seu auth preenche req.user
    });

    return res.json(row);
  } catch (e) {
    console.error('[needs.attachments.upload]', e);
    return res.status(500).json({ error: 'Falha ao anexar arquivo' });
  }
});

/**
 * DELETE /api/needs/:id/attachments/:attachmentId
 */
router.delete('/:id/attachments/:attachmentId', auth(), requireLevel(2), async (req, res) => {
  try {
    const needId = Number(req.params.id);
    const attachmentId = Number(req.params.attachmentId);

    const row = await NeedAttachment.findOne({ where: { id: attachmentId, needId } });
    if (!row) return res.status(404).json({ error: 'Anexo não encontrado' });

    // ✅ remove arquivo do disco (best effort)
    try {
      // row.url exemplo: http://localhost:3000/uploads/needs/10/arquivo.png
      // precisamos extrair só o pathname: /uploads/needs/10/arquivo.png
      const pathname = row.url
        ? new URL(row.url).pathname
        : `/uploads/needs/${needId}/${row.fileName}`;

      // pathname -> uploads/needs/10/arquivo.png
      const rel = pathname.replace(/^\/+/, '');

      // caminho físico real
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
