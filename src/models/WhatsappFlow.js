const { DataTypes, Model } = require('sequelize');
const sequelize = require('../db');

class WhatsappFlow extends Model {}

WhatsappFlow.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    code: {
      type: DataTypes.STRING(60),
      allowNull: false,
      unique: true,
    },
    name: {
      type: DataTypes.STRING(120),
      allowNull: false,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
    isDefault: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    createdById: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    updatedById: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
  },
  {
    sequelize,
    modelName: 'WhatsappFlow',
    tableName: 'whatsapp_flows',
    timestamps: true,
    indexes: [{ fields: ['code'] }, { fields: ['isActive'] }, { fields: ['isDefault'] }],
  }
);

module.exports = WhatsappFlow;
