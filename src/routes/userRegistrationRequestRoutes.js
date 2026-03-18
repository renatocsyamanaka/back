const express = require('express');
const router = express.Router();

const ctrl = require('../controllers/userRegistrationRequestController');
const auth = require('../middleware/auth');
const requireLevel = require('../middleware/rbac');
const { uploadAvatar } = require('../config/upload');

// público: solicitar cadastro
router.post(
  '/',
  uploadAvatar.single('avatar'),
  ctrl.createRequest
);

// privado: gestor para cima
router.get(
  '/',
  auth(),
  requireLevel(3),
  ctrl.listRequests
);

router.put(
  '/:id/approve',
  auth(),
  requireLevel(3),
  ctrl.approveRequest
);

router.put(
  '/:id/reject',
  auth(),
  requireLevel(3),
  ctrl.rejectRequest
);

module.exports = router;