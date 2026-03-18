const { DataTypes, Model } = require('sequelize');
const sequelize = require('../db');

class News extends Model {}

News.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },

    title: { type: DataTypes.STRING(160), allowNull: false },
    content: { type: DataTypes.TEXT('long'), allowNull: false },

    category: { type: DataTypes.STRING(60), allowNull: true },
    imageUrl: { type: DataTypes.STRING, allowNull: true },

    isActive: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },

    // NOVO
    targetAllSectors: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
      field: 'target_all_sectors',
    },

    createdById: { type: DataTypes.INTEGER, allowNull: true },
  },
  {
    sequelize,
    modelName: 'News',
    tableName: 'news',
    timestamps: true,
    indexes: [
      { fields: ['isActive'] },
      { fields: ['createdById'] },
      { fields: ['target_all_sectors'] },
    ],
  }
);

module.exports = News;