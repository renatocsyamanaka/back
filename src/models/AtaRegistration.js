const { DataTypes, Model } = require('sequelize');
const sequelize = require('../db');

class AtaRegistration extends Model {}

AtaRegistration.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },

    needId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      unique: true,
    },

    status: {
      type: DataTypes.ENUM(
        'DRAFT',
        'SUBMITTED',
        'UNDER_REVIEW',
        'APPROVED',
        'REJECTED',
        'ADJUSTMENT_REQUIRED'
      ),
      allowNull: false,
      defaultValue: 'DRAFT',
    },

    fullName: {
      type: DataTypes.STRING(180),
      allowNull: true,
    },

    cpf: {
      type: DataTypes.STRING(30),
      allowNull: true,
    },

    rg: {
      type: DataTypes.STRING(80),
      allowNull: true,
    },

    address: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },

    email: {
      type: DataTypes.STRING(180),
      allowNull: true,
    },

    submittedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },

    reviewedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },

    reviewedById: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },

    reviewNotes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
  },
  {
    sequelize,
    modelName: 'AtaRegistration',
    tableName: 'ata_registrations',
    timestamps: true,
  }
);

module.exports = AtaRegistration;