const Product = require('../models/product.model'); // Adjust path as needed

/**
 * Get display title for a Shopify product variant.
 * @param {string} productId - Shopify product ID
 * @param {string} variantId - Shopify variant ID
 * @returns {Promise<string>} - Title to display
 */
const getVariantDisplayTitle = async (productId, variantId) => {
  const product = await Product.findOne({ shopifyProductId: productId });

  if (!product) {
    throw new Error(`Product not found for ID ${productId}`);
  }

  const variant = product.variants.find(
    (v) => v.shopifyVariantId === variantId
  );

  if (!variant) {
    throw new Error(`Variant not found for ID ${variantId}`);
  }

  return variant.title && variant.title !== 'Default Title'
    ? variant.title
    : product.title;
};

module.exports = { getVariantDisplayTitle };
