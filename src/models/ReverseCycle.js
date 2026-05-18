const { DataTypes } = require('sequelize');
const sequelize = require('../db');

const ReverseCycle = sequelize.define('ReverseCycle', {
  name: { type: DataTypes.STRING, allowNull: true },
  referenceMonth: { type: DataTypes.STRING, allowNull: true },
  month: { type: DataTypes.INTEGER, allowNull: false },
  year: { type: DataTypes.INTEGER, allowNull: false },
  status: { type: DataTypes.ENUM('ABERTO', 'FECHADO'), allowNull: false, defaultValue: 'ABERTO' },
  requestDate: { type: DataTypes.DATEONLY, allowNull: true },
  sendDate: { type: DataTypes.DATE, allowNull: true },
  dueDate: { type: DataTypes.DATE, allowNull: true },
  notes: { type: DataTypes.TEXT, allowNull: true },
  createdByName: { type: DataTypes.STRING, allowNull: true },
  createdByEmail: { type: DataTypes.STRING, allowNull: true },
});

module.exports = ReverseCycle;
