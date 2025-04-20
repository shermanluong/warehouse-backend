const SubstitutionRule = require('../models/substitution.model');
const Product = require('../models/product.model');

// Get smart substitution rule for a product
const getSubstitution = async (req, res) => {
  try {
    const { productId, variantId } = req.query;

    if (!productId || !variantId) {
      return res.status(400).json({ error: 'Missing productId or variantId' });
    }

    // 1. Find substitution rule
    const rule = await SubstitutionRule.findOne({
      originalProductId: productId,
      originalVariantId: variantId,
    });

    if (!rule) {
      return res.status(404).json({ error: 'Substitution rule not found' });
    }

    // 2. Get original product
    const originalProduct = await Product.findOne({
      shopifyProductId: productId,
      'variants.shopifyVariantId': variantId,
    });

    const originalVariant = originalProduct?.variants.find(
      v => v.shopifyVariantId === variantId
    );

    if (!originalVariant) {
      return res.status(404).json({ error: 'Original variant not found' });
    }

    // 3. Fetch all substitute variants and their product info
    const substituteIds = rule.substitutes.map(s => s.substituteVariantId);

    const substituteProducts = await Product.find({
      'variants.shopifyVariantId': { $in: substituteIds }
    });

    const substituteVariantsDetailed = [];

    for (const substitute of rule.substitutes) {
      const parentProduct = substituteProducts.find(p =>
        p.variants.some(v => v.shopifyVariantId === substitute.substituteVariantId)
      );
      const variant = parentProduct?.variants.find(
        v => v.shopifyVariantId === substitute.substituteVariantId
      );
      if (parentProduct && variant) {
        substituteVariantsDetailed.push({
          substituteProductId: substitute.substituteProductId,
          substituteVariantId: substitute.substituteVariantId,
          reason: substitute.reason,
          priority: substitute.priority,
          productTitle: parentProduct.title,
          image: parentProduct.image,
          variantTitle: variant.title,
          sku: variant.sku,
          price: variant.price
        });
      }
    }

    // 4. Send response
    res.json({
      original: {
        productId,
        variantId,
        productTitle: originalProduct?.title,
        image: originalProduct?.image,
        variantTitle: originalVariant?.title,
        sku: originalVariant?.sku,
        price: originalVariant?.price,
      },
      substitutes: substituteVariantsDetailed,
    });

  } catch (err) {
    console.error('Error fetching substitution rule details:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Admin creates substitution rule
const createSubstitution = async (req, res) => {
  try {
    const {
      originalProductId,
      originalVariantId,
      substitutes,
      createdBy,
    } = req.body;

    if (!originalVariantId || !Array.isArray(substitutes) || substitutes.length === 0) {
      return res.status(400).json({ error: 'Missing required fields.' });
    }

    // Try to find existing rule
    let rule = await SubstitutionRule.findOne({
      originalProductId,
      originalVariantId,
    });

    if (rule) {
      // Filter out duplicates based on substituteVariantId
      const existingVariantIds = rule.substitutes.map(s => s.substituteVariantId);
      const newSubstitutes = substitutes.filter(
        s => !existingVariantIds.includes(s.substituteVariantId)
      );

      if (newSubstitutes.length === 0) {
        return res.status(200).json({ message: 'No new substitutes added. All already exist.' });
      }

      rule.substitutes.push(...newSubstitutes);
      await rule.save();
      return res.status(200).json(rule);
    }

    // Create new rule
    rule = new SubstitutionRule({
      originalProductId,
      originalVariantId,
      substitutes,
      createdBy,
    });

    await rule.save();
    res.status(201).json(rule);

  } catch (err) {
    console.error('Error saving substitution rule:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
};

module.exports = {
  getSubstitution,
  createSubstitution
};
