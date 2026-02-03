const { DataTypes, Model } = require('sequelize');
const sequelize = require('../db');

class Need extends Model {}

Need.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },

    status: {
      type: DataTypes.ENUM('OPEN', 'IN_PROGRESS', 'FULFILLED', 'CANCELLED'),
      allowNull: false,
      defaultValue: 'OPEN',
    },

    requestedLocationText: { type: DataTypes.STRING, allowNull: false },
    requestedCity: { type: DataTypes.STRING, allowNull: true },
    requestedState: { type: DataTypes.STRING(2), allowNull: true },
    requestedCep: { type: DataTypes.STRING, allowNull: true },

    requestedLat: { type: DataTypes.FLOAT, allowNull: true },
    requestedLng: { type: DataTypes.FLOAT, allowNull: true },

    requestedName: { type: DataTypes.STRING, allowNull: false },

    providerName: { type: DataTypes.STRING, allowNull: true },
    providerWhatsapp: { type: DataTypes.STRING, allowNull: true },

    negotiationTier: {
      type: DataTypes.ENUM('OURO', 'PRATA', 'BRONZE'),
      allowNull: true,
    },

    negotiationNotes: { type: DataTypes.TEXT, allowNull: true },

    // 🔥 NOVOS STATUS DE HOMOLOGAÇÃO
    homologTablesStatus: {
      type: DataTypes.ENUM('PENDENTE', 'EM_ANDAMENTO', 'CONCLUIDO'),
      allowNull: true,
      defaultValue: 'PENDENTE',
    },
    homologDocsStatus: {
      type: DataTypes.ENUM('PENDENTE', 'EM_ANDAMENTO', 'CONCLUIDO'),
      allowNull: true,
      defaultValue: 'PENDENTE',
    },
    homologContractStatus: {
      type: DataTypes.ENUM('PENDENTE', 'EM_ANDAMENTO', 'CONCLUIDO'),
      allowNull: true,
      defaultValue: 'PENDENTE',
    },
    homologCrmStatus: {
      type: DataTypes.ENUM('PENDENTE', 'EM_ANDAMENTO', 'CONCLUIDO'),
      allowNull: true,
      defaultValue: 'PENDENTE',
    },
    homologErpStatus: {
      type: DataTypes.ENUM('PENDENTE', 'EM_ANDAMENTO', 'CONCLUIDO'),
      allowNull: true,
      defaultValue: 'PENDENTE',
    },
  },
  {
    sequelize,
    modelName: 'Need',
    tableName: 'needs',
    timestamps: true,
  }
);

module.exports = Need;
