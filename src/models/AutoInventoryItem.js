const { DataTypes } = require('sequelize');
const sequelize = require('../db');

const AutoInventoryItem = sequelize.define('AutoInventoryItem', {
  codigo: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
  },
  nome: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  ativo: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
  },
  hasSerialNumber: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false,
  },
  serialNumberRequired: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false,
  },
});

module.exports = AutoInventoryItem;
