const { DataTypes } = require('sequelize');
const sequelize = require('../db');

const ReverseResponseItem = sequelize.define('ReverseResponseItem', {
  quantidade: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  observacao: { type: DataTypes.TEXT, allowNull: true },
});

module.exports = ReverseResponseItem;
