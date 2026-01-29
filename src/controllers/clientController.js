// controllers/clientController.js
const { Op } = require('sequelize');
const { Client } = require('../models');

exports.list = async (req, res) => {
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

  const rows = await Client.findAll({ where, order: [['id', 'DESC']] });
  res.json({ data: rows });
};
