const { DataTypes, Model } = require('sequelize');
const sequelize = require('../db');

class News extends Model {}

News.init({
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  title: { type: DataTypes.STRING(255), allowNull: false },
  summary: { type: DataTypes.STRING(500), allowNull: true },
  body: { type: DataTypes.TEXT('long'), allowNull: false },
  audience: { type: DataTypes.ENUM('ALL', 'ROLE', 'USER'), allowNull: false, defaultValue: 'ALL' },
  targetRoleLevel: { type: DataTypes.INTEGER, allowNull: true },
  targetUserId: { type: DataTypes.INTEGER, allowNull: true },
  coverUrl: { type: DataTypes.STRING, allowNull: true },
  tags: { type: DataTypes.JSON, allowNull: true },
  pinned: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
  imageUrl: { type: DataTypes.STRING, allowNull: true },
  minRoleLevel: { type: DataTypes.INTEGER, allowNull: true }, // não usado
  publishedAt: { type: DataTypes.DATE, allowNull: true },
  expiresAt: { type: DataTypes.DATE, allowNull: true },
  createdById: { type: DataTypes.INTEGER, allowNull: true },
}, {
  sequelize,
  modelName: 'News',
  tableName: 'news',
});

module.exports = News;
