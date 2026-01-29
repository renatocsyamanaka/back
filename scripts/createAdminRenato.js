// scripts/createAdminRenato.js
require('dotenv').config();
const bcrypt = require('bcryptjs');
const { sequelize, User, Role } = require('../src/models');

(async () => {
  try {
    await sequelize.authenticate();

    // 1) Garante que o cargo Admin exista
    const [adminRole] = await Role.findOrCreate({
      where: { name: 'Admin' },
      defaults: { level: 5 }
    });

    // 2) Defina aqui o e-mail/senha do admin
    const name = 'Renato Yamanaka';
    const email = 'renatoyamanaka@empresa.com'; // ajuste se quiser
    const plainPassword = 'Admin@123';           // ajuste e troque depois

    // 3) Cria ou atualiza
    const [user, created] = await User.findOrCreate({
      where: { email },
      defaults: {
        name,
        roleId: adminRole.id,
        password_hash: plainPassword, // será hasheado pelo hook beforeCreate
        sex: 'O',
        isActive: true
      }
    });

    if (!created) {
      // Se já existia, atualiza para Admin e (opcional) troca senha
      user.roleId = adminRole.id;

      // Descomente se quiser forçar troca de senha agora:
      // user.password_hash = await bcrypt.hash(plainPassword, 10);

      await user.save();
      console.log(`✅ Usuário já existia. Promovido a Admin: ${email}`);
    } else {
      console.log(`✅ Usuário Admin criado: ${email}`);
    }
  } catch (err) {
    console.error('❌ Erro ao criar admin:', err);
  } finally {
    await sequelize.close();
  }
})();
