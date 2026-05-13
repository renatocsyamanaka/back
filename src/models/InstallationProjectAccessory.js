const { DataTypes, Model } = require('sequelize');
const sequelize = require('../db');

class InstallationProjectAccessory extends Model {}

InstallationProjectAccessory.init(
  {
    projectId: { type: DataTypes.INTEGER, allowNull: false },
    accessoryName: { type: DataTypes.STRING, allowNull: false },
    accessoryCode: { type: DataTypes.STRING, allowNull: true },
    qty: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
    isTrailer: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
  },
  {
    sequelize,
    modelName: 'InstallationProjectAccessory',
    tableName: 'installation_project_accessories',
  }
);

module.exports = InstallationProjectAccessory;
