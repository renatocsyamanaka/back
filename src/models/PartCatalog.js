const { DataTypes, Model } = require('sequelize');
const sequelize = require('../db');

class PartCatalog extends Model {}

PartCatalog.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },

    code: {
      type: DataTypes.STRING(100),
      allowNull: false,
      unique: true,
    },

    name: {
      type: DataTypes.STRING(200),
      allowNull: false,
    },

    unit: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: 'UN',
    },

    category: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },

    brand: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },

    description: {
      type: DataTypes.TEXT('long'),
      allowNull: true,
    },

    isActive: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },

    createdById: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
  },
  {
    sequelize,
    modelName: 'PartCatalog',
    tableName: 'part_catalog',
    timestamps: true,
    indexes: [
      { unique: true, fields: ['code'] },
      { fields: ['name'] },
      { fields: ['isActive'] },
      { fields: ['createdById'] },
    ],
  }
);

module.exports = PartCatalog;