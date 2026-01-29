// src/models/InstallationProjectItem.js
const { DataTypes, Model } = require('sequelize');
const sequelize = require('../db');

class InstallationProjectItem extends Model {}

InstallationProjectItem.init(
  {
    projectId: { type: DataTypes.INTEGER, allowNull: false },

    equipmentName: { type: DataTypes.STRING, allowNull: false }, // "Rastreador X"
    equipmentCode: { type: DataTypes.STRING, allowNull: true },  // opcional
    qty:           { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
  },
  {
    sequelize,
    modelName: 'InstallationProjectItem',
    tableName: 'installation_project_items',
  }
);

module.exports = InstallationProjectItem;