const express = require('express');
const { getSubstitution, createSubstitution } = require('../controllers/substitution.controller');

const router = express.Router();

// Get substitution suggestion for a product
router.get('/:productId', getSubstitution);

// Admin can define new substitution rule
router.post('/', createSubstitution);

module.exports = router;
