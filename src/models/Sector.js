const { DataTypes, Model } = require('sequelize');
const sequelize = require('../db');

class Sector extends Model {}

Sector.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    name: { type: DataTypes.STRING(100), allowNull: false, unique: true },
    isActive: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
  },
  {
    sequelize,
    modelName: 'Sector',
    tableName: 'sectors',
    timestamps: true,
  }
);

module.exports = Sector;