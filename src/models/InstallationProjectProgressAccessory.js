const { DataTypes, Model } = require('sequelize');
const sequelize = require('../db');

class InstallationProjectProgressAccessory extends Model {}

InstallationProjectProgressAccessory.init(
  {
    progressId: { type: DataTypes.INTEGER, allowNull: false },
    accessoryName: { type: DataTypes.STRING, allowNull: false },
    accessoryCode: { type: DataTypes.STRING, allowNull: true },
    plate: { type: DataTypes.STRING(10), allowNull: false },
    qty: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
    notes: { type: DataTypes.STRING, allowNull: true },
  },
  {
    sequelize,
    modelName: 'InstallationProjectProgressAccessory',
    tableName: 'installation_project_progress_accessories',
  }
);

module.exports = InstallationProjectProgressAccessory;
