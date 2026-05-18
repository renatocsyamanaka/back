/*
  Script opcional para desativar os itens de exemplo criados pelas versões antigas
  do módulo Reversa. Ele NÃO apaga registros, apenas marca como inativo para não
  aparecer no link público.

  Rodar dentro do backend:
  node src/scripts/limparItensPadraoReversa.js
*/
const { Op } = require('sequelize');
const { sequelize, ReverseItem } = require('../models');

const defaultCodes = ['RASTREADOR', 'ANTENA', 'CHICOTE', 'CAMERA', 'TECLADO', 'MODULO', 'OUTROS'];

async function main() {
  const [count] = await ReverseItem.update(
    { ativo: false },
    { where: { codigo: { [Op.in]: defaultCodes } } }
  );
  console.log(`[reversa] Itens padrão desativados: ${count}`);
}

main()
  .catch((err) => {
    console.error('[reversa] Falha ao desativar itens padrão:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await sequelize.close();
  });
