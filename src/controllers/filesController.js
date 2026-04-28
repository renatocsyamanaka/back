const fs = require('fs');
const path = require('path');

const BASE_DIR = path.resolve('uploads');

function readDirRecursive(dir, baseUrl = '/uploads') {
  const results = [];

  const list = fs.readdirSync(dir);

  list.forEach((file) => {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);

    if (stat && stat.isDirectory()) {
      results.push(
        ...readDirRecursive(fullPath, `${baseUrl}/${file}`)
      );
    } else {
      results.push({
        name: file,
        path: fullPath,
        url: `${baseUrl}/${file}`,
        size: stat.size,
        createdAt: stat.birthtime,
        folder: baseUrl.replace('/uploads/', ''),
      });
    }
  });

  return results;
}

module.exports = {
  listAll: (req, res) => {
    try {
      const files = readDirRecursive(BASE_DIR);

      return res.json(files);
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: 'Erro ao listar arquivos' });
    }
  },

  deleteFile: (req, res) => {
    try {
      const { filePath } = req.body;

      if (!filePath) {
        return res.status(400).json({ error: 'filePath obrigatório' });
      }

      const fullPath = path.resolve(filePath);

      if (fs.existsSync(fullPath)) {
        fs.unlinkSync(fullPath);
      }

      return res.json({ ok: true });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: 'Erro ao excluir arquivo' });
    }
  },
};