const { DataTypes, Model } = require('sequelize');
const sequelize = require('../db');

class TechType extends Model {}
TechType.init({
  name: { type: DataTypes.STRING, allowNull: false }, // "Instalador", "Field", "Elétrica", "Fibra", etc.
  description: { type: DataTypes.STRING }
}, { sequelize, modelName: 'TechType', tableName: 'tech_types' });

module.exports = TechType;
