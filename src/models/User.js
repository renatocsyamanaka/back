// models/User.js
const { DataTypes, Model } = require('sequelize');
const sequelize = require('../db');
const bcrypt = require('bcryptjs');

class User extends Model {
  async checkPassword(pw) {
    if (!this.password_hash) return false;
    return bcrypt.compare(pw, this.password_hash);
  }
}

User.init(
  {
    name: { type: DataTypes.STRING, allowNull: false },

    // Agora podem ser nulos para perfis sem login (técnico/PSO/ATA/PRP/SPOT)
    email: {
      type: DataTypes.STRING,
      allowNull: true,
      unique: true,
      validate: { isEmail: true },
    },
    password_hash: { type: DataTypes.STRING, allowNull: true },

    // Flag que define se precisa de credenciais
    loginEnabled: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },

    sex: { type: DataTypes.ENUM('M', 'F', 'O'), allowNull: true },
    avatarUrl: { type: DataTypes.STRING, allowNull: true },
    isActive: { type: DataTypes.BOOLEAN, defaultValue: true },

    // relacionamento simples
    managerId: { type: DataTypes.INTEGER, allowNull: true },

    // pertence ao estoque avançado?
    estoqueAvancado: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },

    // Dados complementares
    phone: { type: DataTypes.STRING, allowNull: true },
    vendorCode: { type: DataTypes.STRING, allowNull: true },
    serviceAreaCode: { type: DataTypes.STRING, allowNull: true },
    serviceAreaName: { type: DataTypes.STRING, allowNull: true },

    // NOVO: tipo de atendimento
    tipoAtendimento: {
      type: DataTypes.ENUM('FX', 'VL', 'FV'),
      allowNull: true,
      field: 'tipo_atendimento',
      validate: {
        isIn: [['FX', 'VL', 'FV']],
      },
    },

    // Endereço
    addressStreet: { type: DataTypes.STRING, allowNull: true },
    addressNumber: { type: DataTypes.STRING, allowNull: true },
    addressComplement: { type: DataTypes.STRING, allowNull: true },
    addressDistrict: { type: DataTypes.STRING, allowNull: true },
    addressCity: { type: DataTypes.STRING, allowNull: true },
    addressState: { type: DataTypes.STRING, allowNull: true },
    addressZip: { type: DataTypes.STRING, allowNull: true },
    addressCountry: { type: DataTypes.STRING, allowNull: true, defaultValue: 'Brasil' },

    // Coordenadas
    lat: { type: DataTypes.DECIMAL(10, 7), allowNull: true },
    lng: { type: DataTypes.DECIMAL(10, 7), allowNull: true },
  },
  {
    sequelize,
    modelName: 'User',
    tableName: 'users',
  }
);

// ===== Hooks =====

// Regras condicionais: só exige email/senha se loginEnabled = true
User.addHook('beforeValidate', (user) => {
  if (user.loginEnabled !== false) {
    if (!user.email) throw new Error('E-mail é obrigatório para usuários com login');
    if (!user.password_hash) throw new Error('Senha é obrigatória para usuários com login');
  }
});

// Hash ao criar
User.addHook('beforeCreate', async (user) => {
  if (user.password_hash && !user.password_hash.startsWith('$2a$')) {
    user.password_hash = await bcrypt.hash(user.password_hash, 10);
  }
});

// Hash ao atualizar (quando trocar senha)
User.addHook('beforeUpdate', async (user) => {
  if (
    user.changed('password_hash') &&
    user.password_hash &&
    !user.password_hash.startsWith('$2a$')
  ) {
    user.password_hash = await bcrypt.hash(user.password_hash, 10);
  }
});

module.exports = User;