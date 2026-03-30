const { DataTypes, Model } = require('sequelize');
const sequelize = require('../db');

class NeedInternalDocument extends Model {}

NeedInternalDocument.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },

    title: {
      type: DataTypes.STRING,
      allowNull: true,
    },

    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },

    originalName: {
      type: DataTypes.STRING,
      allowNull: false,
    },

    fileName: {
      type: DataTypes.STRING,
      allowNull: false,
    },

    mimeType: {
      type: DataTypes.STRING,
      allowNull: false,
    },

    size: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },

    url: {
      type: DataTypes.STRING,
      allowNull: false,
    },

    uploadedById: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
  },
  {
    sequelize,
    modelName: 'NeedInternalDocument',
    tableName: 'need_internal_documents',
    timestamps: true,
    indexes: [{ fields: ['uploadedById'] }],
  }
);

module.exports = NeedInternalDocument;