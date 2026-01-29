// src/models/newsRead.js
const { DataTypes, Model } = require('sequelize');
const sequelize = require('../db');

class NewsRead extends Model {}

NewsRead.init(
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },

    userId: { type: DataTypes.INTEGER, allowNull: false },
    newsId: { type: DataTypes.INTEGER, allowNull: false },

    // Estes dois campos existem na sua tabela:
    seenAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    readAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  },
  {
    sequelize,
    modelName: 'NewsRead',
    tableName: 'news_reads',
    timestamps: false,                 // 👈 importante!
    indexes: [{ unique: true, fields: ['userId', 'newsId'] }],
  }
);

module.exports = NewsRead;
