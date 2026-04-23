const { DataTypes, Model } = require('sequelize');
const sequelize = require('../db');

class WhatsappFlowStep extends Model {}

WhatsappFlowStep.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    flowId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    code: {
      type: DataTypes.STRING(60),
      allowNull: false,
    },
    title: {
      type: DataTypes.STRING(120),
      allowNull: false,
    },
    stepType: {
      type: DataTypes.ENUM('MESSAGE', 'QUESTION', 'LOOKUP_NOTE', 'CONFIRMATION', 'END'),
      allowNull: false,
      defaultValue: 'MESSAGE',
    },
    content: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    buttons: {
      type: DataTypes.JSON,
      allowNull: true,
    },
    expectedInputType: {
      type: DataTypes.ENUM('FREE_TEXT', 'YES_NO', 'NOTE_NUMBER', 'NONE'),
      allowNull: false,
      defaultValue: 'NONE',
    },
    nextStepCode: {
      type: DataTypes.STRING(60),
      allowNull: true,
    },
    fallbackStepCode: {
      type: DataTypes.STRING(60),
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
  },
  {
    sequelize,
    modelName: 'WhatsappFlowStep',
    tableName: 'whatsapp_flow_steps',
    timestamps: true,
    indexes: [
      { fields: ['flowId'] },
      { fields: ['code'] },
      { fields: ['stepType'] },
      { fields: ['sortOrder'] },
      { unique: true, fields: ['flowId', 'code'] },
    ],
  }
);

module.exports = WhatsappFlowStep;
