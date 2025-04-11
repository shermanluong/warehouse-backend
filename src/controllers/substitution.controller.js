const Substitution = require('../models/substitution.model');

// Get smart substitution rule for a product
const getSubstitution = async (req, res) => {
  const { productId } = req.params;

  try {
    const rule = await Substitution.findOne({ originalProductId: productId });

    if (!rule) return res.status(404).json({ message: 'No substitution found' });

    res.json(rule);
  } catch (err) {
    console.error('Failed to get substitution:', err);
    res.status(500).json({ error: 'Server error' });
  }
};

// Admin creates substitution rule
const createSubstitution = async (req, res) => {
  const { originalProductId, substituteProductId, reason } = req.body;

  try {
    const rule = new Substitution({ originalProductId, substituteProductId, reason });
    await rule.save();
    res.status(201).json({ message: 'Substitution rule created', rule });
  } catch (err) {
    console.error('Failed to create substitution rule:', err);
    res.status(500).json({ error: 'Server error' });
  }
};

module.exports = {
  getSubstitution,
  createSubstitution
};
