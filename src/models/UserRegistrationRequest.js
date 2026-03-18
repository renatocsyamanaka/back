const { DataTypes, Model } = require('sequelize');
const sequelize = require('../db');
const bcrypt = require('bcryptjs');

class UserRegistrationRequest extends Model {}

UserRegistrationRequest.init(
  {
    fullName: {
      type: DataTypes.STRING,
      allowNull: false,
      field: 'full_name',
    },
    email: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
      validate: { isEmail: true },
    },
    password_hash: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    sex: {
      type: DataTypes.ENUM('M', 'F', 'O'),
      allowNull: true,
    },
    roleId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: 'role_id',
    },
    managerId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: 'manager_id',
    },
    phone: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    avatarUrl: {
      type: DataTypes.STRING,
      allowNull: true,
      field: 'avatar_url',
    },
    status: {
      type: DataTypes.ENUM('PENDING', 'APPROVED', 'REJECTED'),
      allowNull: false,
      defaultValue: 'PENDING',
    },
    reviewNotes: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: 'review_notes',
    },
    approvedById: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: 'approved_by_id',
    },
    approvedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'approved_at',
    },
    rejectedById: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: 'rejected_by_id',
    },
    rejectedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'rejected_at',
    },
  },
  {
    sequelize,
    modelName: 'UserRegistrationRequest',
    tableName: 'user_registration_requests',
  }
);

UserRegistrationRequest.addHook('beforeCreate', async (row) => {
  if (row.password_hash && !row.password_hash.startsWith('$2')) {
    row.password_hash = await bcrypt.hash(row.password_hash, 10);
  }
});

module.exports = UserRegistrationRequest;