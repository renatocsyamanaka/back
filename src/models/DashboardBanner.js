const { DataTypes, Model, Op } = require('sequelize');
const sequelize = require('../db');

function clean(value) {
  if (value === undefined || value === null) return null;
  const str = String(value).trim();
  return str === '' ? null : str;
}

class DashboardBanner extends Model {}

DashboardBanner.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },

    title: {
      type: DataTypes.STRING(160),
      allowNull: false,
    },

    subtitle: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },

    imageUrl: {
      type: DataTypes.STRING,
      allowNull: true,
    },

    buttonLabel: {
      type: DataTypes.STRING(60),
      allowNull: true,
    },

    buttonUrl: {
      type: DataTypes.STRING,
      allowNull: true,
    },

    sortOrder: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },

    isActive: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },

    startsAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },

    endsAt: {
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
    modelName: 'DashboardBanner',
    tableName: 'dashboard_banners',
    timestamps: true,
    paranoid: false,
    indexes: [
      { fields: ['isActive'] },
      { fields: ['sortOrder'] },
      { fields: ['startsAt'] },
      { fields: ['endsAt'] },
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
        item.subtitle = clean(item.subtitle);
        item.imageUrl = clean(item.imageUrl);
        item.buttonLabel = clean(item.buttonLabel);
        item.buttonUrl = clean(item.buttonUrl);

        if (item.sortOrder === '' || item.sortOrder === null || item.sortOrder === undefined) {
          item.sortOrder = 0;
        }
      },
    },
  }
);

module.exports = DashboardBanner;