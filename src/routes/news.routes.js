const router = require('express').Router();
const auth = require('../middleware/auth');        // precisa popular req.user
const requireLevel = require('../middleware/rbac'); // req.user.role.level
const ctrl = require('../controllers/newsController');

let { uploadNews } = (() => { try { return require('../config/upload'); } catch { return {}; } })();
if (!uploadNews || typeof uploadNews.single !== 'function') {
  const multer = require('multer');
  const path = require('path');
  const fs = require('fs');
  const dir = path.resolve(__dirname, '..', '..', 'uploads', 'news');
  fs.mkdirSync(dir, { recursive: true });
  const storage = multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, dir),
    filename: (_req, file, cb) => {
      const ext = (file.originalname && file.originalname.includes('.'))
        ? '.' + file.originalname.split('.').pop().toLowerCase() : '';
      cb(null, `${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}${ext}`);
    },
  });
  uploadNews = multer({ storage });
}

// Criar (Supervisor+). Campo do arquivo: "image"
router.post('/', auth(), requireLevel(2), uploadNews.single('image'), ctrl.create);

// Listar feed
router.get('/', auth(), ctrl.list);

// Marcar como lida
router.post('/:id/read', auth(), ctrl.markRead);

// Remover (Gerente+)
router.delete('/:id', auth(), requireLevel(4), ctrl.remove);

module.exports = router;
