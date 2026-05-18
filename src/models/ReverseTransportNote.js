const { DataTypes } = require('sequelize');
const sequelize = require('../db');

const ReverseTransportNote = sequelize.define('ReverseTransportNote', {
  fornecedor: { type: DataTypes.STRING, allowNull: true },
  notaEntrada: { type: DataTypes.STRING, allowNull: true },
  data: { type: DataTypes.DATEONLY, allowNull: true },
  total: { type: DataTypes.DECIMAL(12,2), allowNull: true },
  emiteNf: { type: DataTypes.ENUM('SIM','NAO','VERIFICAR'), allowNull: true },
  nfDeclaracao: { type: DataTypes.STRING, allowNull: true },
  transportadora: { type: DataTypes.STRING, allowNull: true },
  valorRetorno: { type: DataTypes.DECIMAL(12,2), allowNull: true },
  observacao: { type: DataTypes.TEXT, allowNull: true },
  anexoNome: { type: DataTypes.STRING, allowNull: true },
  anexoUrl: { type: DataTypes.STRING, allowNull: true },
});

module.exports = ReverseTransportNote;
