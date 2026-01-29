const { DataTypes, Model } = require('sequelize');
const sequelize = require('../db');

class InstallationProjectProgressVehicle extends Model {}

InstallationProjectProgressVehicle.init(
  {
    progressId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },

    plate: {
      type: DataTypes.STRING(10),
      allowNull: false,
    },

    serial: {
      type: DataTypes.STRING(60),
      allowNull: false,
    },
  },
  {
    sequelize,
    tableName: 'installation_project_progress_vehicles',
    modelName: 'InstallationProjectProgressVehicle',
  }
);

module.exports = InstallationProjectProgressVehicle;
