const { DataTypes, Model } = require('sequelize');
const sequelize = require('../db');

class InstallationProjectProgress extends Model {}

InstallationProjectProgress.init(
  {
    projectId: { type: DataTypes.INTEGER, allowNull: false },

    date: { type: DataTypes.DATEONLY, allowNull: false },

    trucksDoneToday: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },

    // métricas
    completedInstallations: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    failedInstallations: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    plannedInstallations: { type: DataTypes.INTEGER, allowNull: true },

    // mapa de calor
    lat: { type: DataTypes.FLOAT, allowNull: true },
    lng: { type: DataTypes.FLOAT, allowNull: true },

    notes: { type: DataTypes.TEXT, allowNull: true },

    createdById: { type: DataTypes.INTEGER, allowNull: false },
  },
  {
    sequelize,
    modelName: 'InstallationProjectProgress',
    tableName: 'installation_project_progress',
  }
);


module.exports = InstallationProjectProgress;