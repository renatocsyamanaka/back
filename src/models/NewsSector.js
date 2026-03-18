const { DataTypes, Model } = require('sequelize');
const sequelize = require('../db');

class NewsSector extends Model {}

NewsSector.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },

    newsId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'news_id',
      references: {
        model: 'news',
        key: 'id',
      },
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE',
    },

    sectorId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'sector_id',
      references: {
        model: 'sectors',
        key: 'id',
      },
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE',
    },
  },
  {
    sequelize,
    modelName: 'NewsSector',
    tableName: 'news_sectors',
    timestamps: false,
    indexes: [
      { unique: true, fields: ['news_id', 'sector_id'] },
      { fields: ['news_id'] },
      { fields: ['sector_id'] },
    ],
  }
);

module.exports = NewsSector;