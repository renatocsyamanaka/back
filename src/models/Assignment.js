const { DataTypes, Model } = require('sequelize');
const sequelize = require('../db');

class Assignment extends Model {}

Assignment.init({
  start: { type: DataTypes.DATE, allowNull: false },  // ex: 2025-08-11 09:00
  end:   { type: DataTypes.DATE, allowNull: false },
  description: { type: DataTypes.STRING },
  type: { type: DataTypes.ENUM('CLIENT','INTERNAL','TRAVEL'), defaultValue: 'CLIENT' }
}, {
  sequelize,
  modelName: 'Assignment',
  tableName: 'assignments',
  // indexes ajudam nos filtros por intervalo
  indexes: [{ fields: ['start'] }, { fields: ['userId'] }]
});

module.exports = Assignment;
