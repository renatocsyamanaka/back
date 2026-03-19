const { DataTypes, Model } = require('sequelize');
const sequelize = require('../db');

class InstallationProject extends Model {}

InstallationProject.init(
  {
    status: {
      type: DataTypes.ENUM('A_INICIAR', 'INICIADO', 'FINALIZADO'),
      allowNull: false,
      defaultValue: 'A_INICIAR',
    },

    title: {
      type: DataTypes.STRING,
      allowNull: false,
    },

    af: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },

    clientId: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },

    contactName: {
      type: DataTypes.STRING,
      allowNull: true,
    },

    // legado
    contactEmail: {
      type: DataTypes.STRING,
      allowNull: false,
    },

    // novo
    contactEmails: {
      type: DataTypes.JSON,
      allowNull: true,
      defaultValue: [],
    },

    contactPhone: {
      type: DataTypes.STRING,
      allowNull: true,
    },

    // datas sem hora
    startPlannedAt: {
      type: DataTypes.DATEONLY,
      allowNull: true,
    },

    endPlannedAt: {
      type: DataTypes.DATEONLY,
      allowNull: true,
    },

    // datas com hora
    startAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },

    endAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },

    trucksTotal: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1,
    },

    trucksDone: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },

    equipmentsTotal: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },

    equipmentsPerDay: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },

    daysEstimated: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },

    whatsappGroupName: {
      type: DataTypes.STRING,
      allowNull: true,
    },

    whatsappGroupLink: {
      type: DataTypes.STRING,
      allowNull: true,
    },

    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },

    supervisorId: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },

    coordinatorId: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },

    // legado
    technicianId: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },

    // novo
    technicianIds: {
      type: DataTypes.JSON,
      allowNull: true,
      defaultValue: [],
    },

    createdById: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },

    updatedById: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
  },
  {
    sequelize,
    modelName: 'InstallationProject',
    tableName: 'installation_projects',
  }
);

module.exports = InstallationProject;