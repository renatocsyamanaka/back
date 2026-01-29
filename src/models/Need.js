const { DataTypes, Model } = require('sequelize');
const sequelize = require('../db');

class Need extends Model {}

Need.init(
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },

    status: {
      type: DataTypes.ENUM('OPEN', 'IN_PROGRESS', 'FULFILLED', 'CANCELLED'),
      allowNull: false,
      defaultValue: 'OPEN',
    },

    // pedido (entrada)
    requestedName: { type: DataTypes.STRING(160), allowNull: false },
    notes: { type: DataTypes.TEXT, allowNull: true },

    // local (texto curto)
    requestedLocationText: { type: DataTypes.STRING(255), allowNull: false }, // ex: "São Bernardo do Campo - SP"
    requestedCity: { type: DataTypes.STRING(120), allowNull: true },
    requestedState: { type: DataTypes.STRING(2), allowNull: true },
    requestedCep: { type: DataTypes.STRING(12), allowNull: true },

    // coords (mapa)
    requestedLat: { type: DataTypes.DECIMAL(10, 7), allowNull: true },
    requestedLng: { type: DataTypes.DECIMAL(10, 7), allowNull: true },

    // opcional
    techTypeId: { type: DataTypes.INTEGER, allowNull: true },

    // auditoria
    requestedByUserId: { type: DataTypes.INTEGER, allowNull: true },

    // captação/homologação
    providerName: { type: DataTypes.STRING(160), allowNull: true },
    providerWhatsapp: { type: DataTypes.STRING(30), allowNull: true },

    negotiationTier: {
      type: DataTypes.ENUM('OURO', 'PRATA', 'BRONZE'),
      allowNull: true,
    },

    homologationStatus: {
      type: DataTypes.ENUM('NAO_INICIADA', 'EM_ANDAMENTO', 'APROVADO', 'REPROVADO'),
      allowNull: true,
    },

    negotiationNotes: { type: DataTypes.TEXT, allowNull: true },
  },
  {
    sequelize,
    modelName: 'Need',
    tableName: 'needs',
    timestamps: true,
    indexes: [
      { fields: ['status'] },
      { fields: ['techTypeId'] },
      { fields: ['requestedByUserId'] },
      { fields: ['requestedLat', 'requestedLng'] },
    ],
  }
);

module.exports = Need;
