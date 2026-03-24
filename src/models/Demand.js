const { DataTypes, Model, Op } = require('sequelize');
const sequelize = require('../db');

const TIPOS_DEMANDA = [
  'DEV_WEB',
  'DASHBOARD',
  'EXCEL',
  'OUTRAS_DEMANDAS',
];

const STATUS_DEMANDA = [
  'A_INICIAR',
  'EM_ANDAMENTO',
  'DISPONIVEL_TESTE',
  'EM_TESTE',
  'IMPEDIDO',
  'CONCLUIDO',
];

const URGENCIAS = ['BAIXA', 'MEDIA', 'ALTA'];

function cleanString(value) {
  if (value === undefined || value === null) return null;
  const str = String(value).trim();
  return str === '' ? null : str;
}

class Demand extends Model {}

Demand.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },

    tipo: {
      type: DataTypes.ENUM(...TIPOS_DEMANDA),
      allowNull: false,
      defaultValue: 'DEV_WEB',
      validate: {
        isIn: [TIPOS_DEMANDA],
      },
    },

    nome: {
      type: DataTypes.STRING(200),
      allowNull: false,
      validate: {
        notEmpty: {
          msg: 'O nome da demanda é obrigatório.',
        },
        len: {
          args: [2, 200],
          msg: 'O nome da demanda deve ter entre 2 e 200 caracteres.',
        },
      },
    },

    plataforma: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },

    periodicidade: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },

    diaAplicacao: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },

    urgencia: {
      type: DataTypes.ENUM(...URGENCIAS),
      allowNull: true,
      validate: {
        isIn: [URGENCIAS],
      },
    },

    solicitante: {
      type: DataTypes.STRING(150),
      allowNull: true,
    },

    descricao: {
      type: DataTypes.TEXT,
      allowNull: true,
    },

    observacoes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },

    status: {
      type: DataTypes.ENUM(...STATUS_DEMANDA),
      allowNull: false,
      defaultValue: 'A_INICIAR',
      validate: {
        isIn: [STATUS_DEMANDA],
      },
    },

    entregaPrevista: {
      type: DataTypes.DATE,
      allowNull: true,
    },

    dataEntrega: {
      type: DataTypes.DATE,
      allowNull: true,
    },

    workspace: {
      type: DataTypes.STRING(120),
      allowNull: true,
    },

    origemExcelAba: {
      type: DataTypes.STRING(80),
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

    responsavelId: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
  },
  {
    sequelize,
    modelName: 'Demand',
    tableName: 'demands',
    timestamps: true,
    paranoid: false,
    indexes: [
      { fields: ['tipo'] },
      { fields: ['status'] },
      { fields: ['urgencia'] },
      { fields: ['nome'] },
      { fields: ['solicitante'] },
      { fields: ['responsavelId'] },
      { fields: ['createdById'] },
      { fields: ['updatedById'] },
      { fields: ['deletedById'] },
      { fields: ['entregaPrevista'] },
      { fields: ['dataEntrega'] },
      { fields: ['deletedAt'] },
      { fields: ['tipo', 'status'] },
      { fields: ['tipo', 'responsavelId'] },
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
            [Op.ne]: null,
          },
        },
      },
      byType(tipo) {
        return {
          where: { tipo },
        };
      },
      byStatus(status) {
        return {
          where: { status },
        };
      },
    },
    hooks: {
      beforeValidate(demand) {
        demand.nome = cleanString(demand.nome);
        demand.plataforma = cleanString(demand.plataforma);
        demand.periodicidade = cleanString(demand.periodicidade);
        demand.diaAplicacao = cleanString(demand.diaAplicacao);
        demand.solicitante = cleanString(demand.solicitante);
        demand.descricao = cleanString(demand.descricao);
        demand.observacoes = cleanString(demand.observacoes);
        demand.workspace = cleanString(demand.workspace);
        demand.origemExcelAba = cleanString(demand.origemExcelAba);

        if (demand.urgencia) {
          demand.urgencia = String(demand.urgencia).trim().toUpperCase();
        }

        if (demand.tipo) {
          demand.tipo = String(demand.tipo).trim().toUpperCase();
        }

        if (demand.status) {
          demand.status = String(demand.status).trim().toUpperCase();
        }
      },
    },
  }
);

Demand.TIPOS = TIPOS_DEMANDA;
Demand.STATUS = STATUS_DEMANDA;
Demand.URGENCIAS = URGENCIAS;

module.exports = Demand;