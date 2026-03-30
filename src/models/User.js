const { DataTypes, Model } = require('sequelize');
const sequelize = require('../db');
const bcrypt = require('bcryptjs');

const ALLOWED_SECTORS = [
  'OPERACOES',
  'LOGISTICA',
  'SISTEMAS',
  'ATENDIMENTO',
];

const ALLOWED_PERMISSIONS = [
  'DASHBOARD_VIEW',
  'INSTALLATION_PROJECTS_VIEW',
  'PART_REQUESTS_VIEW',
  'MY_PART_REQUESTS_VIEW',
  'TECHS_MAP_VIEW',
  'USERS_VIEW',
  'ORG_VIEW',
  'LOCATIONS_VIEW',
  'CLIENTS_VIEW',
  'TASKS_VIEW',
  'TECH_TYPES_VIEW',
  'NEEDS_VIEW',
  'NEEDS_MAP_VIEW',
  'ASSIGNMENTS_VIEW',
  'OVERTIME_VIEW',
  'TIMEOFF_VIEW',
  'NEWS_VIEW',
  'NEWS_ADMIN_VIEW',

  'DASHBOARD_ACTIVITY_VIEW',
  'DELIVERY_REPORTS_VIEW',
];

const DEFAULT_SECTORS = ['OPERACOES'];
const DEFAULT_PERMISSIONS = ['DASHBOARD_VIEW', 'ASSIGNMENTS_VIEW'];

function normalizeArray(value, fallback = []) {
  if (value === undefined || value === null || value === '') {
    return [...fallback];
  }

  let arr = value;

  if (typeof arr === 'string') {
    arr = arr.includes(',') ? arr.split(',') : [arr];
  }

  if (!Array.isArray(arr)) {
    arr = [arr];
  }

  arr = arr
    .map((item) => String(item || '').trim().toUpperCase())
    .filter(Boolean);

  arr = [...new Set(arr)];

  return arr.length ? arr : [...fallback];
}

class User extends Model {
  async checkPassword(pw) {
    if (!this.password_hash) return false;
    return bcrypt.compare(pw, this.password_hash);
  }
}

User.init(
  {
    name: {
      type: DataTypes.STRING,
      allowNull: false,
    },

    email: {
      type: DataTypes.STRING,
      allowNull: true,
      validate: {
        isEmail: true,
      },
    },

    password_hash: {
      type: DataTypes.STRING,
      allowNull: true,
    },

    loginEnabled: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },

    sex: {
      type: DataTypes.ENUM('M', 'F', 'O'),
      allowNull: true,
    },

    avatarUrl: {
      type: DataTypes.STRING,
      allowNull: true,
    },

    isActive: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },

    managerId: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },

    roleId: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    cargoDescritivo: {
      type: DataTypes.STRING(150),
      allowNull: true,
    },

    ocultarCargo: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    sectors: {
      type: DataTypes.JSON,
      allowNull: false,
      defaultValue: DEFAULT_SECTORS,
      validate: {
        isValidSectors(value) {
          if (!Array.isArray(value)) {
            throw new Error('O campo sectors deve ser um array.');
          }

          if (!value.length) {
            throw new Error('Informe ao menos um setor.');
          }

          const invalid = value.filter(
            (s) => !ALLOWED_SECTORS.includes(String(s).trim().toUpperCase())
          );

          if (invalid.length) {
            throw new Error(`Setores inválidos: ${invalid.join(', ')}`);
          }
        },
      },
    },

    permissions: {
      type: DataTypes.JSON,
      allowNull: false,
      defaultValue: DEFAULT_PERMISSIONS,
      validate: {
        isValidPermissions(value) {
          if (!Array.isArray(value)) {
            throw new Error('O campo permissions deve ser um array.');
          }

          if (!value.length) {
            throw new Error('Informe ao menos uma permissão.');
          }

          const invalid = value.filter(
            (p) => !ALLOWED_PERMISSIONS.includes(String(p).trim().toUpperCase())
          );

          if (invalid.length) {
            throw new Error(`Permissões inválidas: ${invalid.join(', ')}`);
          }
        },
      },
    },

    estoqueAvancado: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },

    phone: {
      type: DataTypes.STRING,
      allowNull: true,
    },

    vendorCode: {
      type: DataTypes.STRING,
      allowNull: true,
    },

    serviceAreaCode: {
      type: DataTypes.STRING,
      allowNull: true,
    },

    serviceAreaName: {
      type: DataTypes.STRING,
      allowNull: true,
    },

    tipoAtendimento: {
      type: DataTypes.ENUM('FX', 'VL', 'FV'),
      allowNull: true,
      field: 'tipo_atendimento',
      validate: {
        isIn: [['FX', 'VL', 'FV']],
      },
    },

    addressStreet: {
      type: DataTypes.STRING,
      allowNull: true,
    },

    addressNumber: {
      type: DataTypes.STRING,
      allowNull: true,
    },

    addressComplement: {
      type: DataTypes.STRING,
      allowNull: true,
    },

    addressDistrict: {
      type: DataTypes.STRING,
      allowNull: true,
    },

    addressCity: {
      type: DataTypes.STRING,
      allowNull: true,
    },

    addressState: {
      type: DataTypes.STRING,
      allowNull: true,
    },

    addressZip: {
      type: DataTypes.STRING,
      allowNull: true,
    },

    addressCountry: {
      type: DataTypes.STRING,
      allowNull: true,
      defaultValue: 'Brasil',
    },

    lat: {
      type: DataTypes.DECIMAL(10, 7),
      allowNull: true,
    },

    lng: {
      type: DataTypes.DECIMAL(10, 7),
      allowNull: true,
    },
  },
  {
    sequelize,
    modelName: 'User',
    tableName: 'users',
  }
);

User.addHook('beforeValidate', (user) => {
  if (user.loginEnabled !== false) {
    if (!user.email) {
      throw new Error('E-mail é obrigatório para usuários com login');
    }

    if (!user.password_hash) {
      throw new Error('Senha é obrigatória para usuários com login');
    }
  }

  user.sectors = normalizeArray(user.sectors, DEFAULT_SECTORS);
  user.permissions = normalizeArray(user.permissions, DEFAULT_PERMISSIONS);
});

User.addHook('beforeCreate', async (user) => {
  if (user.password_hash && !user.password_hash.startsWith('$2')) {
    user.password_hash = await bcrypt.hash(user.password_hash, 10);
  }
});

User.addHook('beforeUpdate', async (user) => {
  if (
    user.changed('password_hash') &&
    user.password_hash &&
    !user.password_hash.startsWith('$2')
  ) {
    user.password_hash = await bcrypt.hash(user.password_hash, 10);
  }

  user.sectors = normalizeArray(user.sectors, DEFAULT_SECTORS);
  user.permissions = normalizeArray(user.permissions, DEFAULT_PERMISSIONS);
});

module.exports = User;
module.exports.ALLOWED_SECTORS = ALLOWED_SECTORS;
module.exports.ALLOWED_PERMISSIONS = ALLOWED_PERMISSIONS;
module.exports.DEFAULT_SECTORS = DEFAULT_SECTORS;
module.exports.DEFAULT_PERMISSIONS = DEFAULT_PERMISSIONS;