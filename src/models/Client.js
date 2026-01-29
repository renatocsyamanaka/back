const { DataTypes, Model } = require('sequelize');
const sequelize = require('../db');

class Client extends Model {}

Client.init(
  {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey: true,
      allowNull: false,
    },

    idCliente: { type: DataTypes.STRING(50), allowNull: false, unique: true, field: 'ID_cliente' },

    name: { type: DataTypes.STRING, allowNull: false, field: 'cliente' },
    nomeFantasia: { type: DataTypes.STRING, allowNull: true, field: 'nome_fantasia' },
    documento: { type: DataTypes.STRING(30), allowNull: true, field: 'cpf/cnpj' },
    tipoCliente: { type: DataTypes.STRING(10), allowNull: true, field: 'tipo_cliente' },
    segmentacao: { type: DataTypes.STRING(120), allowNull: true },

    estado: { type: DataTypes.STRING(2), allowNull: true },
    cidade: { type: DataTypes.STRING(120), allowNull: true },
    bairro: { type: DataTypes.STRING(120), allowNull: true },
    logradouro: { type: DataTypes.TEXT, allowNull: true },
    complemento: { type: DataTypes.STRING(120), allowNull: true },
    cep: { type: DataTypes.STRING(10), allowNull: true },

    latitude: { type: DataTypes.STRING(20), allowNull: true },
    longitude: { type: DataTypes.STRING(20), allowNull: true },

    email1: { type: DataTypes.STRING(255), allowNull: true },
    telefone1: { type: DataTypes.STRING(30), allowNull: true },
    email2: { type: DataTypes.STRING(255), allowNull: true },
    telefone2: { type: DataTypes.STRING(30), allowNull: true },
  },
  {
    sequelize,
    modelName: 'Client',
    tableName: 'clients',
    timestamps: false,     // ✅ ESSENCIAL
    freezeTableName: true, // ✅ evita pluralização do sequelize
  }
);

module.exports = Client;
