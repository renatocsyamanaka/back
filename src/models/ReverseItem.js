const { DataTypes } = require('sequelize');
const sequelize = require('../db');

const ReverseItem = sequelize.define('ReverseItem', {
  codigo: { type: DataTypes.STRING, allowNull: true, unique: true },
  nome: { type: DataTypes.STRING, allowNull: false },
  categoria: { type: DataTypes.STRING, allowNull: true },
  ativo: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
  hasSerialNumber: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
  serialNumberRequired: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
  observacao: { type: DataTypes.TEXT, allowNull: true },
  ordem: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
});

module.exports = ReverseItem;
