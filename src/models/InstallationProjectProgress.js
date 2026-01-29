const { DataTypes, Model } = require('sequelize');
const sequelize = require('../db');
const InstallationProjectProgressVehicle = require('./InstallationProjectProgressVehicle');

class InstallationProjectProgress extends Model {}

InstallationProjectProgress.init(
  {
    projectId: { type: DataTypes.INTEGER, allowNull: false },

    date: { type: DataTypes.DATEONLY, allowNull: false },

    trucksDoneToday: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    notes: { type: DataTypes.TEXT, allowNull: true },

    createdById: { type: DataTypes.INTEGER, allowNull: false },
  },
  {
    sequelize,
    modelName: 'InstallationProjectProgress',
    tableName: 'installation_project_progress',
  }
);

// ✅ Associar aqui (uma única vez)
InstallationProjectProgress.hasMany(InstallationProjectProgressVehicle, {
  foreignKey: { name: 'progressId', allowNull: false },
  as: 'vehicles',
  onDelete: 'CASCADE',
  onUpdate: 'CASCADE',
});

InstallationProjectProgressVehicle.belongsTo(InstallationProjectProgress, {
  foreignKey: { name: 'progressId', allowNull: false },
  as: 'progress',
});

module.exports = InstallationProjectProgress;
