const router = require('express').Router();
const auth = require('../middleware/auth');
const requireLevel = require('../middleware/rbac');
const ctrl = require('../controllers/needController');
const needInternalDocumentController = require('../controllers/needInternalDocumentController');

const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { Need, NeedAttachment } = require('../models');

/** =========================
 *  Helpers uploads
 *  ========================= */
function ensureDir(p) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

/** =========================
 *  UPLOAD POR NEED
 *  ========================= */
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
  limits: { fileSize: 15 * 1024 * 1024 },
});

/** =========================
 *  UPLOAD GLOBAL - DOCUMENTOS INTERNOS
 *  ========================= */
const internalStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    const dir = path.join(process.cwd(), 'uploads', 'needs', 'internal-documents');
    ensureDir(dir);
    cb(null, dir);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname || '');
    const safe = `${Date.now()}-${Math.random().toString(16).slice(2)}${ext}`;
    cb(null, safe);
  },
});

const uploadInternal = multer({
  storage: internalStorage,
  limits: { fileSize: 15 * 1024 * 1024 },
});

/** =========================
 *  ROTAS PRINCIPAIS
 *  ========================= */
router.post('/', auth(), requireLevel(2), ctrl.create);
router.get('/', auth(), ctrl.list);
router.get('/requesters', auth(), ctrl.requesters);
router.patch('/:id/status', auth(), requireLevel(2), ctrl.updateStatus);
router.patch('/:id/provider', auth(), requireLevel(2), ctrl.updateProvider);
router.patch('/:id/address', auth(), requireLevel(2), ctrl.updateAddress);

/** ============================================================
 * DOCUMENTOS INTERNOS GLOBAIS
 * ============================================================ */
router.get(
  '/internal-documents',
  auth(),
  needInternalDocumentController.list
);

router.post(
  '/internal-documents',
  auth(),
  requireLevel(2),
  uploadInternal.single('file'),
  needInternalDocumentController.create
);

router.delete(
  '/internal-documents/:id',
  auth(),
  requireLevel(2),
  needInternalDocumentController.remove
);

/** =========================
 *  ANEXOS / HOMOLOGAÇÃO POR NEED
 *  ========================= */

const NEED_ATTACHMENT_KINDS = ['CONTRATO', 'DOCUMENTO', 'FOTO', 'HOMOLOGACAO', 'OUTRO'];

function normalizeAttachment(row) {
  return {
    id: row.id,
    needId: row.needId,
    kind: row.kind,
    title: row.title || row.originalName,
    description: row.description || null,
    originalName: row.originalName,
    fileName: row.fileName,
    mimeType: row.mimeType,
    size: row.size,
    url: row.url,
    uploadedById: row.uploadedById,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function getUploadedFiles(req) {
  if (Array.isArray(req.files) && req.files.length) return req.files;
  if (req.files && typeof req.files === 'object') {
    const grouped = [];
    Object.values(req.files).forEach((arr) => {
      if (Array.isArray(arr)) grouped.push(...arr);
    });
    if (grouped.length) return grouped;
  }
  if (req.file) return [req.file];
  return [];
}

const uploadAttachments = upload.fields([
  { name: 'file', maxCount: 1 },
  { name: 'files', maxCount: 20 },
]);

/**
 * LISTAR ANEXOS
 * GET /api/needs/:id/attachments?kind=HOMOLOGACAO
 */
router.get('/:id/attachments', auth(), async (req, res) => {
  try {
    const needId = Number(req.params.id);
    const where = { needId };

    if (req.query.kind) {
      const kind = String(req.query.kind).toUpperCase();
      if (!NEED_ATTACHMENT_KINDS.includes(kind)) {
        return res.status(400).json({ error: 'kind inválido' });
      }
      where.kind = kind;
    }

    const rows = await NeedAttachment.findAll({
      where,
      order: [['createdAt', 'DESC']],
    });

    return res.json(rows.map(normalizeAttachment));
  } catch (e) {
    console.error('[needs.attachments.list]', e);
    return res.status(500).json({ error: 'Falha ao listar anexos' });
  }
});

/**
 * UPLOAD DE ANEXOS
 * POST /api/needs/:id/attachments
 */
router.post('/:id/attachments', auth(), requireLevel(2), uploadAttachments, async (req, res) => {
  try {
    const needId = Number(req.params.id);

    const need = await Need.findByPk(needId);
    if (!need) return res.status(404).json({ error: 'Need não encontrada' });

    const files = getUploadedFiles(req);
    if (!files.length) {
      return res.status(400).json({ error: 'Arquivo não enviado (campo "file" ou "files")' });
    }

    const kind = String(req.body?.kind || 'DOCUMENTO').toUpperCase();
    if (!NEED_ATTACHMENT_KINDS.includes(kind)) {
      return res.status(400).json({ error: 'kind inválido' });
    }

    const title = req.body?.title ? String(req.body.title).trim() : null;
    const description = req.body?.description ? String(req.body.description).trim() : null;

    const createdRows = await Promise.all(
      files.map((file, index) => {
        const resolvedTitle =
          files.length > 1
            ? (title ? `${title} ${index + 1}` : file.originalname)
            : (title || file.originalname);

        return NeedAttachment.create({
          needId,
          kind,
          title: resolvedTitle,
          description,
          originalName: file.originalname,
          fileName: file.filename,
          mimeType: file.mimetype,
          size: file.size,
          url: `/uploads/needs/${needId}/${file.filename}`,
          uploadedById: req.user?.id || null,
        });
      })
    );

    if (createdRows.length === 1) {
      return res.json(normalizeAttachment(createdRows[0]));
    }

    return res.json({
      ok: true,
      count: createdRows.length,
      items: createdRows.map(normalizeAttachment),
    });
  } catch (e) {
    console.error('[needs.attachments.upload]', e);
    return res.status(500).json({ error: 'Falha ao anexar arquivo' });
  }
});

/**
 * EXCLUIR ANEXO
 * DELETE /api/needs/:id/attachments/:attachmentId
 */
router.delete('/:id/attachments/:attachmentId', auth(), requireLevel(2), async (req, res) => {
  try {
    const needId = Number(req.params.id);
    const attachmentId = Number(req.params.attachmentId);

    const row = await NeedAttachment.findOne({ where: { id: attachmentId, needId } });
    if (!row) return res.status(404).json({ error: 'Anexo não encontrado' });

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

/**
 * LISTAR SOMENTE DOCUMENTOS DE HOMOLOGAÇÃO
 * GET /api/needs/:id/homologation-documents
 */
router.get('/:id/homologation-documents', auth(), async (req, res) => {
  try {
    const needId = Number(req.params.id);
    const rows = await NeedAttachment.findAll({
      where: { needId, kind: 'HOMOLOGACAO' },
      order: [['createdAt', 'DESC']],
    });

    return res.json(rows.map(normalizeAttachment));
  } catch (e) {
    console.error('[needs.homologation.list]', e);
    return res.status(500).json({ error: 'Falha ao listar documentos de homologação' });
  }
});

/**
 * UPLOAD SOMENTE DE HOMOLOGAÇÃO
 * POST /api/needs/:id/homologation-documents
 */
router.post('/:id/homologation-documents', auth(), requireLevel(2), uploadAttachments, async (req, res) => {
  try {
    const needId = Number(req.params.id);

    const need = await Need.findByPk(needId);
    if (!need) return res.status(404).json({ error: 'Need não encontrada' });

    const files = getUploadedFiles(req);
    if (!files.length) {
      return res.status(400).json({ error: 'Arquivo não enviado (campo "file" ou "files")' });
    }

    const title = req.body?.title ? String(req.body.title).trim() : null;
    const description = req.body?.description ? String(req.body.description).trim() : null;

    const createdRows = await Promise.all(
      files.map((file, index) => {
        const resolvedTitle =
          files.length > 1
            ? (title ? `${title} ${index + 1}` : file.originalname)
            : (title || file.originalname);

        return NeedAttachment.create({
          needId,
          kind: 'HOMOLOGACAO',
          title: resolvedTitle,
          description,
          originalName: file.originalname,
          fileName: file.filename,
          mimeType: file.mimetype,
          size: file.size,
          url: `/uploads/needs/${needId}/${file.filename}`,
          uploadedById: req.user?.id || null,
        });
      })
    );

    return res.json({
      ok: true,
      count: createdRows.length,
      items: createdRows.map(normalizeAttachment),
    });
  } catch (e) {
    console.error('[needs.homologation.upload]', e);
    return res.status(500).json({ error: 'Falha ao enviar documentos de homologação' });
  }
});

/**
 * EXCLUIR DOCUMENTO DE HOMOLOGAÇÃO
 * DELETE /api/needs/:id/homologation-documents/:attachmentId
 */
router.delete('/:id/homologation-documents/:attachmentId', auth(), requireLevel(2), async (req, res) => {
  try {
    const needId = Number(req.params.id);
    const attachmentId = Number(req.params.attachmentId);

    const row = await NeedAttachment.findOne({
      where: { id: attachmentId, needId, kind: 'HOMOLOGACAO' },
    });

    if (!row) {
      return res.status(404).json({ error: 'Documento de homologação não encontrado' });
    }

    try {
      const pathname = row.url || `/uploads/needs/${needId}/${row.fileName}`;
      const rel = pathname.replace(/^\/+/, '');
      const filePath = path.resolve(process.cwd(), rel);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    } catch (err) {
      console.warn('[needs.homologation.delete] falha ao apagar arquivo:', err?.message);
    }

    await row.destroy();
    return res.json({ ok: true });
  } catch (e) {
    console.error('[needs.homologation.delete]', e);
    return res.status(500).json({ error: 'Falha ao remover documento de homologação' });
  }
});

module.exports = router;