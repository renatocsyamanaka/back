const multer = require('multer');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 17* 1024 * 1024 }, // 10MB
});

module.exports = upload;
