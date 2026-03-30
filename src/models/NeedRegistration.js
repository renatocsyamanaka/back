const { DataTypes, Model } = require('sequelize');
const sequelize = require('../db');

class NeedRegistration extends Model {}

NeedRegistration.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },

    needId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },

    inviteId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      unique: true,
    },

    flowType: {
      type: DataTypes.ENUM('DEFAULT', 'ATA_SIMPLE'),
      allowNull: false,
      defaultValue: 'DEFAULT',
    },

    status: {
      type: DataTypes.ENUM(
        'DRAFT',
        'SUBMITTED',
        'UNDER_REVIEW',
        'ADJUSTMENT_REQUIRED',
        'APPROVED',
        'REJECTED'
      ),
      allowNull: false,
      defaultValue: 'DRAFT',
    },

    fullName: { type: DataTypes.STRING(180), allowNull: true },
    rg: { type: DataTypes.STRING(80), allowNull: true },
    cpf: { type: DataTypes.STRING(30), allowNull: true },
    birthDate: { type: DataTypes.DATEONLY, allowNull: true },
    motherName: { type: DataTypes.STRING(180), allowNull: true },

    address: { type: DataTypes.STRING(255), allowNull: true },
    district: { type: DataTypes.STRING(120), allowNull: true },
    company: { type: DataTypes.STRING(180), allowNull: true },
    city: { type: DataTypes.STRING(120), allowNull: true },
    state: { type: DataTypes.STRING(2), allowNull: true },
    zipCode: { type: DataTypes.STRING(12), allowNull: true },
    phone: { type: DataTypes.STRING(40), allowNull: true },
    roleName: { type: DataTypes.STRING(120), allowNull: true },

    cnpj: { type: DataTypes.STRING(20), allowNull: true },
    email: { type: DataTypes.STRING(180), allowNull: true },

    employeeRegistration: { type: DataTypes.STRING(50), allowNull: true },

    schedulingContactName: { type: DataTypes.STRING(180), allowNull: true },
    schedulingContactEmail: { type: DataTypes.STRING(180), allowNull: true },
    schedulingContactPhone: { type: DataTypes.STRING(40), allowNull: true },

    paymentContactName: { type: DataTypes.STRING(180), allowNull: true },
    paymentContactEmail: { type: DataTypes.STRING(180), allowNull: true },
    paymentContactPhone: { type: DataTypes.STRING(40), allowNull: true },

    witnessName: { type: DataTypes.STRING(180), allowNull: true },
    witnessCpf: { type: DataTypes.STRING(20), allowNull: true },
    witnessEmail: { type: DataTypes.STRING(180), allowNull: true },
    witnessPhone: { type: DataTypes.STRING(40), allowNull: true },

    bankName: { type: DataTypes.STRING(120), allowNull: true },
    bankCode: { type: DataTypes.STRING(20), allowNull: true },
    agency: { type: DataTypes.STRING(20), allowNull: true },
    agencyDigit: { type: DataTypes.STRING(10), allowNull: true },
    accountNumber: { type: DataTypes.STRING(30), allowNull: true },
    accountDigit: { type: DataTypes.STRING(10), allowNull: true },

    hasCltEmployees: { type: DataTypes.BOOLEAN, allowNull: true },

    serviceOmnilinkWorkshop: { type: DataTypes.BOOLEAN, allowNull: true, defaultValue: false },
    serviceLinkerWorkshop: { type: DataTypes.BOOLEAN, allowNull: true, defaultValue: false },
    serviceOmnilinkExternal: { type: DataTypes.BOOLEAN, allowNull: true, defaultValue: false },
    serviceLinkerExternal: { type: DataTypes.BOOLEAN, allowNull: true, defaultValue: false },

    vehicleCar: { type: DataTypes.BOOLEAN, allowNull: true, defaultValue: false },
    vehicleMoto: { type: DataTypes.BOOLEAN, allowNull: true, defaultValue: false },
    vehicleTruck: { type: DataTypes.BOOLEAN, allowNull: true, defaultValue: false },

    agreeTravel: { type: DataTypes.BOOLEAN, allowNull: true },
    declarationAccepted: { type: DataTypes.BOOLEAN, allowNull: true },

    submittedAt: { type: DataTypes.DATE, allowNull: true },
    reviewedAt: { type: DataTypes.DATE, allowNull: true },
    reviewedById: { type: DataTypes.INTEGER, allowNull: true },
    reviewNotes: { type: DataTypes.TEXT, allowNull: true },
  },
  {
    sequelize,
    modelName: 'NeedRegistration',
    tableName: 'need_registrations',
    timestamps: true,
    indexes: [
      { fields: ['needId'] },
      { unique: true, fields: ['inviteId'] },
      { fields: ['status'] },
      { fields: ['flowType'] },
      { fields: ['employeeRegistration'] },
    ],
  }
);

module.exports = NeedRegistration;