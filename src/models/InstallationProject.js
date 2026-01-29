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

    title: { type: DataTypes.STRING, allowNull: false },

    // ✅ NOVO: AF
    af: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },

    clientId: { type: DataTypes.INTEGER, allowNull: true },

    contactName: { type: DataTypes.STRING, allowNull: true },

    // ✅ obrigatório (vai disparar emails)
    contactEmail: { type: DataTypes.STRING, allowNull: false },

    contactPhone: { type: DataTypes.STRING, allowNull: true },

    // ✅ obrigatório
    startPlannedAt: { type: DataTypes.DATE, allowNull: false },
    startAt: { type: DataTypes.DATE, allowNull: true },
    endAt: { type: DataTypes.DATE, allowNull: true },

    // ✅ previsão final calculada no backend
    endPlannedAt: { type: DataTypes.DATE, allowNull: true },

    // ✅ obrigatório (min 1)
    trucksTotal: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
    trucksDone: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },

    equipmentsTotal: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },

    // ✅ obrigatório (Previsão de instalação por dia)
    equipmentsPerDay: { type: DataTypes.INTEGER, allowNull: false },

    daysEstimated: { type: DataTypes.INTEGER, allowNull: true },

    whatsappGroupName: { type: DataTypes.STRING, allowNull: true },
    whatsappGroupLink: { type: DataTypes.STRING, allowNull: true },

    notes: { type: DataTypes.TEXT, allowNull: true },

    supervisorId: { type: DataTypes.INTEGER, allowNull: true }, // ✅ obrigatório
    coordinatorId: { type: DataTypes.INTEGER, allowNull: true }, // ✅ derivado do supervisor

    createdById: { type: DataTypes.INTEGER, allowNull: false },
    updatedById: { type: DataTypes.INTEGER, allowNull: true },
  },
  {
    sequelize,
    modelName: 'InstallationProject',
    tableName: 'installation_projects',
  }
);

module.exports = InstallationProject;
