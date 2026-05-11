const { DataTypes } = require('sequelize');
const sequelize = require('../db');

const AutoInventoryCycle = sequelize.define('AutoInventoryCycle', {
  month: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },

  year: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },

  status: {
    type: DataTypes.ENUM('ABERTO', 'FECHADO'),
    defaultValue: 'ABERTO',
  },

  sendDate: {
    type: DataTypes.DATE,
    allowNull: true,
  },
});

module.exports = AutoInventoryCycle;