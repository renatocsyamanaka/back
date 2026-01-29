const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const root = path.resolve(__dirname, '..', '..');
const dir = path.join(root, 'uploads', 'avatars');
fs.mkdirSync(dir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, dir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const name = crypto.randomBytes(16).toString('hex') + ext;
    cb(null, name);
  }
});

function fileFilter(_req, file, cb) {
  const ok = ['image/jpeg','image/png','image/webp'].includes(file.mimetype);
  cb(ok ? null : new Error('Tipo de arquivo não permitido (jpeg/png/webp)'), ok);
}

const uploadAvatar = multer({
  storage,
  fileFilter,
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB
});

module.exports = { uploadAvatar };
