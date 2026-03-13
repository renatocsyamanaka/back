const { Op } = require('sequelize');
const { PartCatalog } = require('../models');

function clean(v) {
  return String(v || '').trim();
}

module.exports = {
  async create(req, res) {
    try {
      const {
        code,
        name,
        unit = 'UN',
        category,
        brand,
        description,
        isActive = true,
      } = req.body;

      if (!clean(code)) {
        return res.status(400).json({ message: 'Código é obrigatório.' });
      }

      if (!clean(name)) {
        return res.status(400).json({ message: 'Nome é obrigatório.' });
      }

      const exists = await PartCatalog.findOne({
        where: { code: clean(code) },
      });

      if (exists) {
        return res.status(400).json({ message: 'Já existe um item com esse código.' });
      }

      const row = await PartCatalog.create({
        code: clean(code),
        name: clean(name),
        unit: clean(unit) || 'UN',
        category: clean(category) || null,
        brand: clean(brand) || null,
        description: clean(description) || null,
        isActive: Boolean(isActive),
        createdById: req.user?.id || null,
      });

      return res.status(201).json(row);
    } catch (error) {
      console.error('[partCatalog.create]', error);
      return res.status(500).json({
        message: 'Erro ao cadastrar item.',
        error: error.message,
      });
    }
  },

  async list(req, res) {
    try {
      const { q, isActive } = req.query;

      const where = {};

      if (typeof isActive !== 'undefined') {
        where.isActive = String(isActive) === 'true';
      }

      if (clean(q)) {
        where[Op.or] = [
          { code: { [Op.like]: `%${clean(q)}%` } },
          { name: { [Op.like]: `%${clean(q)}%` } },
          { category: { [Op.like]: `%${clean(q)}%` } },
          { brand: { [Op.like]: `%${clean(q)}%` } },
        ];
      }

      const rows = await PartCatalog.findAll({
        where,
        order: [['name', 'ASC']],
      });

      return res.json(rows);
    } catch (error) {
      console.error('[partCatalog.list]', error);
      return res.status(500).json({
        message: 'Erro ao listar itens.',
        error: error.message,
      });
    }
  },

  async show(req, res) {
    try {
      const row = await PartCatalog.findByPk(req.params.id);

      if (!row) {
        return res.status(404).json({ message: 'Item não encontrado.' });
      }

      return res.json(row);
    } catch (error) {
      console.error('[partCatalog.show]', error);
      return res.status(500).json({
        message: 'Erro ao buscar item.',
        error: error.message,
      });
    }
  },

  async update(req, res) {
    try {
      const row = await PartCatalog.findByPk(req.params.id);

      if (!row) {
        return res.status(404).json({ message: 'Item não encontrado.' });
      }

      const { code, name, unit, category, brand, description, isActive } = req.body;

      if (typeof code !== 'undefined' && clean(code) !== row.code) {
        const exists = await PartCatalog.findOne({
          where: {
            code: clean(code),
            id: { [Op.ne]: row.id },
          },
        });

        if (exists) {
          return res.status(400).json({ message: 'Já existe outro item com esse código.' });
        }
      }

      await row.update({
        code: typeof code !== 'undefined' ? clean(code) : row.code,
        name: typeof name !== 'undefined' ? clean(name) : row.name,
        unit: typeof unit !== 'undefined' ? clean(unit) || 'UN' : row.unit,
        category: typeof category !== 'undefined' ? clean(category) || null : row.category,
        brand: typeof brand !== 'undefined' ? clean(brand) || null : row.brand,
        description: typeof description !== 'undefined' ? clean(description) || null : row.description,
        isActive: typeof isActive !== 'undefined' ? Boolean(isActive) : row.isActive,
      });

      return res.json(row);
    } catch (error) {
      console.error('[partCatalog.update]', error);
      return res.status(500).json({
        message: 'Erro ao atualizar item.',
        error: error.message,
      });
    }
  },

  async toggleActive(req, res) {
    try {
      const row = await PartCatalog.findByPk(req.params.id);

      if (!row) {
        return res.status(404).json({ message: 'Item não encontrado.' });
      }

      await row.update({ isActive: !row.isActive });

      return res.json(row);
    } catch (error) {
      console.error('[partCatalog.toggleActive]', error);
      return res.status(500).json({
        message: 'Erro ao alterar status do item.',
        error: error.message,
      });
    }
  },
};