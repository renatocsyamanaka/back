const { DataTypes, Model } = require('sequelize');
const sequelize = require('../db');

class WhatsappConversation extends Model {}

WhatsappConversation.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    phone: {
      type: DataTypes.STRING(30),
      allowNull: false,
    },
    providerChatId: {
      type: DataTypes.STRING(150),
      allowNull: true,
    },
    contactName: {
      type: DataTypes.STRING(150),
      allowNull: true,
    },
    sessionKey: {
      type: DataTypes.STRING(80),
      allowNull: true,
    },
    channel: {
      type: DataTypes.STRING(40),
      allowNull: false,
      defaultValue: 'whatsapp',
    },
    provider: {
      type: DataTypes.STRING(40),
      allowNull: true,
    },
    status: {
      type: DataTypes.ENUM('OPEN', 'WAITING_NOTE', 'WAITING_CONFIRMATION', 'CLOSED', 'TRANSFERRED'),
      allowNull: false,
      defaultValue: 'OPEN',
    },
    botEnabled: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
    currentFlowCode: {
      type: DataTypes.STRING(60),
      allowNull: true,
      defaultValue: 'DEFAULT_TRACKING',
    },
    currentStepCode: {
      type: DataTypes.STRING(60),
      allowNull: true,
      defaultValue: 'GREETING',
    },
    protocol: {
      type: DataTypes.STRING(80),
      allowNull: true,
    },
    lastMessage: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    messagesCount: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    lastUserMessageAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    lastBotMessageAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    lastInteractionAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    lastNoteNumber: {
      type: DataTypes.STRING(80),
      allowNull: true,
    },
    lastCte: {
      type: DataTypes.STRING(80),
      allowNull: true,
    },
    metadata: {
      type: DataTypes.JSON,
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
    closedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  },
  {
    sequelize,
    modelName: 'WhatsappConversation',
    tableName: 'whatsapp_conversations',
    timestamps: true,
    indexes: [
      { fields: ['phone'] },
      { fields: ['providerChatId'] },
      { fields: ['status'] },
      { fields: ['currentFlowCode'] },
      { fields: ['currentStepCode'] },
      { fields: ['lastInteractionAt'] },
      { fields: ['lastNoteNumber'] },
    ],
  }
);

module.exports = WhatsappConversation;