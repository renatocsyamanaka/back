const { DataTypes, Model } = require('sequelize');
const sequelize = require('../db');

class NeedRegistrationDocument extends Model {}

NeedRegistrationDocument.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },

    registrationId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },

    documentTypeId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },

    status: {
      type: DataTypes.ENUM('PENDING', 'SENT', 'APPROVED', 'REJECTED'),
      allowNull: false,
      defaultValue: 'SENT',
    },

    originalName: { type: DataTypes.STRING, allowNull: false },
    fileName: { type: DataTypes.STRING, allowNull: false },
    mimeType: { type: DataTypes.STRING, allowNull: false },
    size: { type: DataTypes.INTEGER, allowNull: false },
    url: { type: DataTypes.STRING, allowNull: false },

    notes: { type: DataTypes.TEXT, allowNull: true },

    uploadedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    reviewedAt: { type: DataTypes.DATE, allowNull: true },
    reviewedById: { type: DataTypes.INTEGER, allowNull: true },
  },
  {
    sequelize,
    modelName: 'NeedRegistrationDocument',
    tableName: 'need_registration_documents',
    timestamps: true,
    indexes: [
      { fields: ['registrationId'] },
      { fields: ['documentTypeId'] },
      { fields: ['status'] },
    ],
  }
);

module.exports = NeedRegistrationDocument;