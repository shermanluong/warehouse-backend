const express = require('express');
const { uploadImage } = require('../controllers/upload.controller');
const router = express.Router();

router.post('/image', uploadImage);

module.exports = router;
