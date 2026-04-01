const { DataTypes, Model, Op } = require('sequelize');
const sequelize = require('../db');

function clean(value) {
  if (value === undefined || value === null) return null;
  const str = String(value).trim();
  return str === '' ? null : str;
}

class DashboardActivity extends Model {}

DashboardActivity.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },

    workspace: {
      type: DataTypes.STRING(120),
      allowNull: false,
    },

    nome: {
      type: DataTypes.STRING(200),
      allowNull: false,
    },
    tipoResponsabilidade: {
      type: DataTypes.ENUM('DASHBOARD', 'PROGRAMACAO', 'BOOT', 'PLANILHA', 'OUTROS'),
      allowNull: true,
    },
    periodicidade: {
      type: DataTypes.ENUM('DIARIO', 'SEMANAL', 'MENSAL'),
      allowNull: false,
      defaultValue: 'DIARIO',
    },

    diaAplicacao: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },

    responsavelId: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },

    urgencia: {
      type: DataTypes.ENUM('BAIXA', 'MEDIA', 'ALTA'),
      allowNull: true,
      defaultValue: 'MEDIA',
    },

    solicitante: {
      type: DataTypes.STRING(150),
      allowNull: true,
    },

    observacoes: {
      type: DataTypes.TEXT,
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
      dashboardLink: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    deletedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  },
  {
    sequelize,
    modelName: 'DashboardActivity',
    tableName: 'dashboard_activities',
    timestamps: true,
    paranoid: false,
    indexes: [
      { fields: ['workspace'] },
      { fields: ['nome'] },
      { fields: ['periodicidade'] },
      { fields: ['responsavelId'] },
      { fields: ['urgencia'] },
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
            [Op.ne]: null,
          },
        },
      },
    },
    hooks: {
      beforeValidate(item) {
        item.workspace = clean(item.workspace);
        item.nome = clean(item.nome);
        item.diaAplicacao = clean(item.diaAplicacao);
        item.solicitante = clean(item.solicitante);
        item.observacoes = clean(item.observacoes);

        if (item.periodicidade) {
          item.periodicidade = String(item.periodicidade).trim().toUpperCase();
        }

        if (item.urgencia) {
          item.urgencia = String(item.urgencia).trim().toUpperCase();
        }
      },
    },
  }
);

module.exports = DashboardActivity;