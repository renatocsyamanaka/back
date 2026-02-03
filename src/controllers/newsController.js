const Joi = require('joi');
const { News } = require('../models');
const { ok, created, bad, notFound } = require('../utils/responses');
const path = require('path');
const fs = require('fs');

const createSchema = Joi.object({
  title: Joi.string().min(3).max(160).required(),
  content: Joi.string().min(3).required(),
  category: Joi.string().max(60).allow(null, ''),
  isActive: Joi.boolean().default(true),
}).required();

const updateSchema = Joi.object({
  title: Joi.string().min(3).max(160).allow(null, ''),
  content: Joi.string().min(3).allow(null, ''),
  category: Joi.string().max(60).allow(null, ''),
  isActive: Joi.boolean().allow(null),
}).required();

function buildImageUrl(req, fileName) {
  const BASE_URL = process.env.BASE_URL || `${req.protocol}://${req.get('host')}`;
  return `${BASE_URL}/uploads/news/${fileName}`;
}

module.exports = {
  async list(req, res) {
    try {
      const rows = await News.findAll({
        order: [['createdAt', 'DESC']],
      });
      return ok(res, rows);
    } catch (e) {
      console.error('[news.list]', e);
      return bad(res, 'Falha ao listar notícias');
    }
  },

  async getById(req, res) {
    try {
      const row = await News.findByPk(req.params.id);
      if (!row) return notFound(res, 'Notícia não encontrada');
      return ok(res, row);
    } catch (e) {
      console.error('[news.getById]', e);
      return bad(res, 'Falha ao buscar notícia');
    }
  },

  async create(req, res) {
    const { error, value } = createSchema.validate(req.body, { stripUnknown: true });
    if (error) return bad(res, error.message);

    try {
      const row = await News.create({
        title: value.title,
        content: value.content,
        category: value.category || null,
        isActive: value.isActive ?? true,
        createdById: req.user?.id || null,
      });

      return created(res, row);
    } catch (e) {
      console.error('[news.create]', e);
      return bad(res, 'Falha ao criar notícia');
    }
  },

  async update(req, res) {
    const { error, value } = updateSchema.validate(req.body, { stripUnknown: true });
    if (error) return bad(res, error.message);

    try {
      const row = await News.findByPk(req.params.id);
      if (!row) return notFound(res, 'Notícia não encontrada');

      await row.update({
        title: value.title != null && value.title !== '' ? value.title : row.title,
        content: value.content != null && value.content !== '' ? value.content : row.content,
        category: value.category != null ? (value.category || null) : row.category,
        isActive: value.isActive != null ? value.isActive : row.isActive,
      });

      return ok(res, row);
    } catch (e) {
      console.error('[news.update]', e);
      return bad(res, 'Falha ao atualizar notícia');
    }
  },

  async remove(req, res) {
    try {
      const row = await News.findByPk(req.params.id);
      if (!row) return notFound(res, 'Notícia não encontrada');

      // remove imagem do disco (best effort)
      if (row.imageUrl) {
        try {
          const u = new URL(row.imageUrl);
          const rel = u.pathname.replace(/^\/+/, ''); // uploads/news/xxx.png
          const filePath = path.resolve(process.cwd(), rel);
          if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        } catch {}
      }

      await row.destroy();
      return ok(res, { ok: true });
    } catch (e) {
      console.error('[news.remove]', e);
      return bad(res, 'Falha ao remover notícia');
    }
  },

  async uploadImage(req, res) {
    try {
      const row = await News.findByPk(req.params.id);
      if (!row) return notFound(res, 'Notícia não encontrada');

      if (!req.file) return bad(res, 'Arquivo não enviado (campo "image")');

      const url = buildImageUrl(req, req.file.filename);

      // remove imagem anterior se existir (best effort)
      if (row.imageUrl) {
        try {
          const u = new URL(row.imageUrl);
          const rel = u.pathname.replace(/^\/+/, '');
          const filePath = path.resolve(process.cwd(), rel);
          if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        } catch {}
      }

      await row.update({ imageUrl: url });
      return ok(res, row);
    } catch (e) {
      console.error('[news.uploadImage]', e);
      return bad(res, 'Falha ao enviar imagem');
    }
  },
};
