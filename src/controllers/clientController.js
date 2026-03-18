const { Op } = require('sequelize');
const { Client } = require('../models');

exports.list = async (req, res) => {
  try {
    const { search, state, city, segment, personType } = req.query;

    const where = {};

    if (state) where.state = state;
    if (city) where.city = city;
    if (segment) where.segment = segment;
    if (personType) where.personType = personType;

    if (search) {
      where[Op.or] = [
        { name: { [Op.like]: `%${search}%` } },
        { tradeName: { [Op.like]: `%${search}%` } },
        { document: { [Op.like]: `%${search}%` } },
        { email1: { [Op.like]: `%${search}%` } },
        { phone1: { [Op.like]: `%${search}%` } },
      ];
    }

    const rows = await Client.findAll({
      where,
      order: [['id', 'DESC']],
    });

    return res.json({ data: rows });
  } catch (error) {
    return res.status(500).json({
      message: 'Erro ao listar clientes.',
      error: error.message,
    });
  }
};

exports.searchAutocomplete = async (req, res) => {
  try {
    const q = String(req.query.q || '').trim();

    if (!q || q.length < 2) {
      return res.json({ data: [] });
    }

    const rows = await Client.findAll({
      attributes: ['id', 'name'],
      where: {
        name: {
          [Op.like]: `%${q}%`,
        },
      },
      order: [['name', 'ASC']],
      limit: 3,
    });

    return res.json({ data: rows });
  } catch (error) {
    return res.status(500).json({
      message: 'Erro ao buscar clientes.',
      error: error.message,
    });
  }
};