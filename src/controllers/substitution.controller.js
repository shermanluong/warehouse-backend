const SubstitutionRule = require('../models/substitution.model');
const Product = require('../models/product.model');

// Get smart substitution rule for a product
const getSubstitution = async (req, res) => {
  try {
    const rules = await SubstitutionRule.find();
    const products = await Product.find();

    // Helper to find variant + its parent product
    const findVariantWithProduct = (productId, variantId) => {
      const product = products.find(p => p.shopifyProductId === productId);
      if (!product) return null;

      const variant = product.variants.find(v => v.shopifyVariantId === variantId);
      if (!variant) return null;

      return {
        title: variant.title === "Default Title" ? product.title : variant.title,
        image: variant.image || product.image || "/placeholder.png",
        sku: variant.sku,
        price: variant.price,
        shopifyProductId: productId,
        shopifyVariantId: variantId,
      };
    };

    const enriched = rules.map(rule => {
      const originProduct = findVariantWithProduct(rule.originalProductId, rule.originalVariantId);

      const enrichedSubstitutes = rule.substitutes.map(sub => ({
        substituteProductId: sub.substituteProductId,
        substituteVariantId: sub.substituteVariantId,
        reason: sub.reason,
        priority: sub.priority,
        substituteProduct: findVariantWithProduct(sub.substituteProductId, sub.substituteVariantId)
      }));

      return {
        _id: rule._id,
        originalProductId: rule.originalProductId,
        originalVariantId: rule.originalVariantId,
        originProduct,
        substitutes: enrichedSubstitutes,
        createdBy: rule.createdBy,
        createdAt: rule.createdAt
      };
    });

    res.json({ rules: enriched });
  } catch (err) {
    console.error("getSubstitution error:", err);
    res.status(500).json({ message: "Failed to fetch substitution rules." });
  }
};

// GET /api/substitutions?productId=xxx&variantId=yyy
const getSubstitutionSuggests = async (req, res) => {
  const { productId, variantId } = req.query;

  if (!productId || !variantId) {
    return res.status(400).json({ error: 'Missing productId or variantId' });
  }

  try {
    const rule = await SubstitutionRule.findOne({
      originalProductId: productId,
      originalVariantId: variantId,
    });

    if (!rule) return res.json({ substitutes: [] });

    const substitutesWithInfo = await Promise.all(
      rule.substitutes.map(async (sub) => {
        const product = await Product.findOne({
          shopifyProductId: sub.substituteProductId,
          'variants.shopifyVariantId': sub.substituteVariantId,
        });

        if (!product) return null;

        const variant = product.variants.find(
          (v) => v.shopifyVariantId === sub.substituteVariantId
        );

        return variant
          ? {
              shopifyVariantId: sub.substituteVariantId,
              shopifyProductId: sub.substituteProductId,
              sku: variant.sku || 'N/A',
              image: variant.image || product.image || '/placeholder.png',
              title:
                variant.title === 'Default Title'
                  ? product.title
                  : variant.title,
              price: variant.price || 'N/A',
            }
          : null;
      })
    );

    res.json({
      substitutes: substitutesWithInfo.filter(Boolean),
    });
  } catch (err) {
    console.error('Error fetching substitutions:', err);
    res.status(500).json({ error: 'Server error' });
  }
};

// Create Rule
const createRule = async (req, res) => {
  const { originalProductId, originalVariantId } = req.body;

  if (!originalProductId || !originalVariantId) {
    return res.status(400).json({ error: "Missing product or variant ID" });
  }
  console.log(req.user);
  if (!req.user || !req.user.userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const exists = await SubstitutionRule.findOne({ originalVariantId });
    if (exists) {
      return res.status(400).json({ error: "Rule already exists" });
    }

    const rule = await SubstitutionRule.create({
      originalProductId,
      originalVariantId,
      substitutes: [],
      createdBy: req.user.id
    });

    res.json(rule);
  } catch (err) {
    console.error("Error creating rule:", err);
    res.status(500).json({ error: "Failed to create rule", details: err.message });
  }
};

const addSubstitution = async (req, res) => {
  const { substituteProductId, substituteVariantId } = req.body;
  try {
    const rule = await SubstitutionRule.findByIdAndUpdate(
      req.params.id,
      {
        $push: {
          substitutes: {
            substituteProductId,
            substituteVariantId,
            reason: "Out of stock",
          }
        }
      },
      { new: true }
    );
    res.json(rule);
  } catch (err) {
    res.status(500).json({ error: "Failed to add substitute" });
  }
};

const deleteRule = async (req, res) => {
  try {
    await SubstitutionRule.findByIdAndDelete(req.params.id);
    res.json({ message: "Rule deleted" });
  } catch (err) {
    res.status(500).json({ error: "Failed to delete rule" });
  }
};

const deleteSubstitute = async (req, res) => {

  const { substituteVariantId } = req.body;
  console.log(req.params.id);
  console.log(substituteVariantId);

  try {
    const rule = await SubstitutionRule.findByIdAndUpdate(
      req.params.id,
      { $pull: { substitutes: { substituteVariantId } } },
      { new: true }
    );
    res.json(rule);
  } catch (err) {
    res.status(500).json({ error: "Failed to remove substitute" });
  }
};

module.exports = {
  getSubstitution,
  createRule,
  addSubstitution,
  deleteRule,
  deleteSubstitute,
  getSubstitutionSuggests
};
