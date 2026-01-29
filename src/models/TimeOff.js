const { DataTypes, Model } = require('sequelize');
const sequelize = require('../db');

class TimeOff extends Model {}
TimeOff.init({
  startDate: { type: DataTypes.DATEONLY, allowNull: false },
  endDate: { type: DataTypes.DATEONLY, allowNull: false },
  type: { 
    type: DataTypes.ENUM('BANCO_HORAS','FERIAS','ATESTADO','OUTROS'),
    defaultValue: 'OUTROS'
  },
  usesBankHours: { type: DataTypes.BOOLEAN, defaultValue: false },
  minutesDeducted: { type: DataTypes.INTEGER, defaultValue: 0 }, // se usar banco
  notes: { type: DataTypes.STRING }
}, { sequelize, modelName: 'TimeOff', tableName: 'time_offs' });

module.exports = TimeOff;
