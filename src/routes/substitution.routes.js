const express = require('express');
const { 
    getSubstitution, 
    createRule,
    addSubstitution,
    deleteRule,
    deleteSubstitute,
    getSubstitutionSuggests
} = require('../controllers/substitution.controller');
const auth = require('../middleware/auth.middleware');
const router = express.Router();

router.get("/rules", auth(['admin']), getSubstitution);
router.post('/rules', auth(['admin']), createRule);
router.put("/rules/:id/add-substitute", auth(['admin']),  addSubstitution);
router.delete("/rules/:id", auth(['admin']),  deleteRule);
router.put("/rules/:id/remove-substitute", auth(['admin']), deleteSubstitute);

router.get("/suggests", auth(['picker']), getSubstitutionSuggests);

module.exports = router;
