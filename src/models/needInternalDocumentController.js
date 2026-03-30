const fs = require('fs');
const path = require('path');
const { NeedInternalDocument } = require('../models');

function normalizeDocument(row) {
  return {
    id: row.id,
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

async function list(req, res) {
  try {
    const rows = await NeedInternalDocument.findAll({
      order: [['createdAt', 'DESC']],
    });

    return res.json(rows.map(normalizeDocument));
  } catch (error) {
    console.error('[needInternalDocument.list]', error);
    return res.status(500).json({ error: 'Falha ao listar documentos internos' });
  }
}

async function create(req, res) {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Arquivo não enviado' });
    }

    const file = req.file;
    const title = req.body?.title ? String(req.body.title).trim() : file.originalname;
    const description = req.body?.description ? String(req.body.description).trim() : null;

    const row = await NeedInternalDocument.create({
      title,
      description,
      originalName: file.originalname,
      fileName: file.filename,
      mimeType: file.mimetype,
      size: file.size,
      url: `/uploads/needs/internal-documents/${file.filename}`,
      uploadedById: req.user?.id || null,
    });

    return res.status(201).json(normalizeDocument(row));
  } catch (error) {
    console.error('[needInternalDocument.create]', error);
    return res.status(500).json({ error: 'Falha ao enviar documento interno' });
  }
}

async function remove(req, res) {
  try {
    const id = Number(req.params.id);

    if (!id) {
      return res.status(400).json({ error: 'ID inválido' });
    }

    const row = await NeedInternalDocument.findByPk(id);

    if (!row) {
      return res.status(404).json({ error: 'Documento interno não encontrado' });
    }

    try {
      const pathname = row.url || `/uploads/needs/internal-documents/${row.fileName}`;
      const rel = pathname.replace(/^\/+/, '');
      const filePath = path.resolve(process.cwd(), rel);

      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    } catch (err) {
      console.warn('[needInternalDocument.remove] falha ao excluir arquivo físico:', err?.message);
    }

    await row.destroy();

    return res.json({ ok: true });
  } catch (error) {
    console.error('[needInternalDocument.remove]', error);
    return res.status(500).json({ error: 'Falha ao excluir documento interno' });
  }
}

module.exports = {
  list,
  create,
  remove,
};