const { DataTypes, Model } = require('sequelize');
const sequelize = require('../db');

class ActivityLog extends Model {}

ActivityLog.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    module: {
      type: DataTypes.STRING(80),
      allowNull: false,
      defaultValue: 'GERAL',
    },
    action: {
      type: DataTypes.STRING(120),
      allowNull: false,
    },
    description: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    entity: {
      type: DataTypes.STRING(80),
      allowNull: true,
    },
    entityId: {
      type: DataTypes.STRING(80),
      allowNull: true,
    },
    userId: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    userName: {
      type: DataTypes.STRING(150),
      allowNull: true,
    },
    userEmail: {
      type: DataTypes.STRING(180),
      allowNull: true,
    },
    method: {
      type: DataTypes.STRING(12),
      allowNull: true,
    },
    path: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    statusCode: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    ip: {
      type: DataTypes.STRING(80),
      allowNull: true,
    },
    userAgent: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    request: {
      type: DataTypes.JSON,
      allowNull: true,
    },
    response: {
      type: DataTypes.JSON,
      allowNull: true,
    },
    errorMessage: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
  },
  {
    sequelize,
    modelName: 'ActivityLog',
    tableName: 'activity_logs',
    timestamps: true,
    indexes: [
      { fields: ['module'] },
      { fields: ['action'] },
      { fields: ['entity'] },
      { fields: ['entityId'] },
      { fields: ['userId'] },
      { fields: ['createdAt'] },
    ],
  }
);

module.exports = ActivityLog;
