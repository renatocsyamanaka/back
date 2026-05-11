const { DataTypes } = require('sequelize');
const sequelize = require('../db');

const AutoInventoryResponse = sequelize.define('AutoInventoryResponse', {
  token: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
  },
  status: {
    type: DataTypes.ENUM('PENDENTE', 'PARCIAL', 'COMPLETO'),
    defaultValue: 'PENDENTE',
  },
  openedAt: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  submittedAt: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  lastUpdateAt: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  reminderSentAt: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  completedMailSentAt: {
    type: DataTypes.DATE,
    allowNull: true,
  },
});

module.exports = AutoInventoryResponse;