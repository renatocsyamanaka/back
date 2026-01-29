// models/OvertimeEntry.js
const { DataTypes, Model } = require('sequelize');
const sequelize = require('../db');

class OvertimeEntry extends Model {}

OvertimeEntry.init(
  {
    userId: { type: DataTypes.INTEGER, allowNull: false },

    // DATEONLY: 'YYYY-MM-DD'
    date: { type: DataTypes.DATEONLY, allowNull: false },

    // minutos + (crédito) ou - (débito)
    minutes: { type: DataTypes.INTEGER, allowNull: false },

    note: { type: DataTypes.STRING, allowNull: true },

    // quem criou / aprovou
    createdById: { type: DataTypes.INTEGER, allowNull: false },
    approvedById: { type: DataTypes.INTEGER, allowNull: true },
  },
  {
    sequelize,
    modelName: 'OvertimeEntry',
    tableName: 'overtime_entries',
    indexes: [
      { fields: ['userId', 'date'] },
      { fields: ['approvedById'] },
      { fields: ['createdById'] },
    ],
  }
);

module.exports = OvertimeEntry;
