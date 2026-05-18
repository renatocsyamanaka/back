const { DataTypes } = require('sequelize');
const sequelize = require('../db');

const ReverseCollectionRequest = sequelize.define('ReverseCollectionRequest', {
  status: { type: DataTypes.ENUM('RASCUNHO','EMAIL_ENVIADO','CANCELADO'), allowNull: false, defaultValue: 'RASCUNHO' },
  recipients: { type: DataTypes.TEXT, allowNull: false },
  cc: { type: DataTypes.TEXT, allowNull: true },
  subject: { type: DataTypes.STRING, allowNull: true },
  body: { type: DataTypes.TEXT, allowNull: true },
  transportadora: { type: DataTypes.STRING, allowNull: true },
  nfDeclaracao: { type: DataTypes.STRING, allowNull: true },
  volumes: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
  observation: { type: DataTypes.TEXT, allowNull: true },
  sentAt: { type: DataTypes.DATE, allowNull: true },
});

module.exports = ReverseCollectionRequest;
