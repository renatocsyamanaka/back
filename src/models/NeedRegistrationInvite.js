const { DataTypes, Model } = require('sequelize');
const sequelize = require('../db');

class NeedRegistrationInvite extends Model {}

NeedRegistrationInvite.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },

    needId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },

    technicianName: {
      type: DataTypes.STRING(180),
      allowNull: false,
    },

    technicianEmail: {
      type: DataTypes.STRING(180),
      allowNull: true,
    },

    technicianPhone: {
      type: DataTypes.STRING(40),
      allowNull: true,
    },

    token: {
      type: DataTypes.STRING(120),
      allowNull: false,
      unique: true,
    },

    status: {
      type: DataTypes.ENUM('PENDING', 'OPENED', 'SUBMITTED', 'EXPIRED', 'CANCELLED'),
      allowNull: false,
      defaultValue: 'PENDING',
    },

    expiresAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },

    openedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },

    usedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },

    lastSentAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },

    createdById: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
  },
  {
    sequelize,
    modelName: 'NeedRegistrationInvite',
    tableName: 'need_registration_invites',
    timestamps: true,
    indexes: [
      { fields: ['needId'] },
      { unique: true, fields: ['token'] },
      { fields: ['status'] },
    ],
  }
);

module.exports = NeedRegistrationInvite;