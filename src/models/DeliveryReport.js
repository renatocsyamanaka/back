const { DataTypes, Model, Op } = require('sequelize');
const sequelize = require('../db');

class DeliveryReport extends Model {}

DeliveryReport.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },

    cte: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },

    tipo: {
      type: DataTypes.STRING(20),
      allowNull: true,
    },

    emissao: {
      type: DataTypes.DATE,
      allowNull: true,
    },

    cidadeOrigem: {
      type: DataTypes.STRING(120),
      allowNull: true,
    },

    ufOrigem: {
      type: DataTypes.STRING(10),
      allowNull: true,
    },

    remetente: {
      type: DataTypes.STRING(200),
      allowNull: true,
    },

    cidadeDestino: {
      type: DataTypes.STRING(120),
      allowNull: true,
    },

    ufDestino: {
      type: DataTypes.STRING(10),
      allowNull: true,
    },

    destinatario: {
      type: DataTypes.STRING(200),
      allowNull: true,
    },

    notaFiscal: {
      type: DataTypes.STRING(80),
      allowNull: true,
    },

    nfValor: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: true,
    },

    pesoReal: {
      type: DataTypes.DECIMAL(15, 3),
      allowNull: true,
    },

    pesoCubado: {
      type: DataTypes.DECIMAL(15, 3),
      allowNull: true,
    },

    pesoTaxado: {
      type: DataTypes.DECIMAL(15, 3),
      allowNull: true,
    },

    volume: {
      type: DataTypes.DECIMAL(15, 3),
      allowNull: true,
    },

    frete: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: true,
    },

    icmsPercent: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
    },

    icmsValor: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: true,
    },

    status: {
      type: DataTypes.STRING(150),
      allowNull: true,
    },

    previsaoEntrega: {
      type: DataTypes.DATE,
      allowNull: true,
    },

    dataEntrega: {
      type: DataTypes.DATE,
      allowNull: true,
    },

    modal: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },

    statusEntrega: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },

    operacao: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },

    operacaoResumo: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },

    cteNovo: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },

    emissaoData: {
      type: DataTypes.DATE,
      allowNull: true,
    },

    transportadora: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },

    encomenda: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },

    reentregaDevolucao: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },

    ultimaAtualizacao: {
      type: DataTypes.DATE,
      allowNull: true,
    },

    indice: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },

    regiao: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },

    createdById: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },

    updatedById: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },

    deletedById: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },

    deletedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  },
  {
    sequelize,
    modelName: 'DeliveryReport',
    tableName: 'delivery_reports',
    timestamps: true,
    indexes: [
      { fields: ['cte'] },
      { fields: ['notaFiscal'] },
      { fields: ['transportadora'] },
      { fields: ['statusEntrega'] },
      { fields: ['cidadeDestino'] },
      { fields: ['ufDestino'] },
      { fields: ['regiao'] },
      { fields: ['operacao'] },
      { fields: ['emissaoData'] },
      { fields: ['createdById'] },
      { fields: ['updatedById'] },
      { fields: ['deletedById'] },
      { fields: ['deletedAt'] },
    ],
    defaultScope: {
      where: {
        deletedAt: null,
      },
    },
    scopes: {
      withDeleted: {},
      onlyDeleted: {
        where: {
          deletedAt: {
            [Op.not]: null,
          },
        },
      },
    },
  }
);

module.exports = DeliveryReport;