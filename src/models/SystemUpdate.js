const { DataTypes, Model, Op } = require('sequelize');
const sequelize = require('../db');

function clean(value) {
  if (value === undefined || value === null) return null;
  const str = String(value).trim();
  return str === '' ? null : str;
}

class SystemUpdate extends Model {}

SystemUpdate.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },

    title: {
      type: DataTypes.STRING(180),
      allowNull: false,
    },

    description: {
      type: DataTypes.TEXT('long'),
      allowNull: false,
    },

    type: {
      type: DataTypes.ENUM('NOVO', 'MELHORIA', 'CORRECAO', 'AVISO'),
      allowNull: false,
      defaultValue: 'MELHORIA',
    },

    module: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },

    isActive: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },

    publishedAt: {
      type: DataTypes.DATE,
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
    modelName: 'SystemUpdate',
    tableName: 'system_updates',
    timestamps: true,
    paranoid: false,
    indexes: [
      { fields: ['type'] },
      { fields: ['module'] },
      { fields: ['isActive'] },
      { fields: ['publishedAt'] },
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
        item.title = clean(item.title);
        item.description = clean(item.description);
        item.module = clean(item.module);

        if (item.type) {
          item.type = String(item.type).trim().toUpperCase();
        }
      },
    },
  }
);

module.exports = SystemUpdate;