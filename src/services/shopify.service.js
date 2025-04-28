// src/services/shopify.service.js
const axios = require('axios');

const PRODUCT_MEDIA_QUERY = `
  query getProductMedia($id: ID!) {
    product(id: $id) {
      images(first: 1) {
        edges {
          node {
            originalSrc
          }
        }
      }
    }
  }
`;

async function getProductImageUrl(productId) {
    const { GraphQLClient } = await import('graphql-request');

    const client = new GraphQLClient(`https://${process.env.SHOPIFY_SHOP}/admin/api/${process.env.SHOPIFY_API_VERSION }/graphql.json`, {
            headers: {
                'X-Shopify-Access-Token': process.env.SHOPIFY_TOKEN,
            },
        });
    const globalId = `gid://shopify/Product/${productId}`;
    try {
      const data = await client.request(PRODUCT_MEDIA_QUERY, { id: globalId });
      const edges = data.product?.images?.edges;
      return edges && edges.length > 0 ? edges[0].node.originalSrc : null;
    } catch (err) {
      console.error(`Error fetching image for product ${productId}`, err);
      return null;
    }
}

const getOrders = async (tags = []) => {
    const shop    = process.env.SHOPIFY_SHOP;
    const token   = process.env.SHOPIFY_TOKEN;
    const version = process.env.SHOPIFY_API_VERSION || '2024-10';

    const url = `https://${shop}/admin/api/${version}/orders.json`;

    // Convert tags array to a comma-separated string
    const tagsQuery = tags.join(',');
    console.log(tagsQuery);
    try {
        const res = await axios.get(url, {
            headers: {
                'X-Shopify-Access-Token': token
            },
            params: {
                fulfillment_status: 'unfulfilled', // Only fetch unfulfilled orders
                limit: 250,
                ...(tagsQuery && { 'tag': tagsQuery })
            }
        });

        return res.data.orders;
    } catch (error) {
        console.error('Error fetching orders from Shopify:', error);
        throw new Error('Failed to fetch orders from Shopify');
    }
};

const getVariantGID = (variantId) =>
  `gid://shopify/ProductVariant/${variantId}`;

/**
 * Adjust inventory quantity of a Shopify product variant by delta (e.g., -1 to decrease).
 * @param {string} variantId Shopify variant ID
 * @param {number} delta +1 to increase, -1 to decrease
 */
const adjustShopifyInventory = async (variantId, delta) => {
  try {
    const variantGID = getVariantGID(variantId);

    // 1. Get inventoryLevelId
    const inventoryLevelRes = await axios.post(
      `https://${process.env.SHOPIFY_SHOP}/admin/api/${process.env.SHOPIFY_API_VERSION}/graphql.json`,
      {
        query: `
          query getInventoryLevel($variantId: ID!) {
            productVariant(id: $variantId) {
              inventoryItem {
                id
                inventoryLevel(locationId: "gid://shopify/Location/${process.env.SHOPIFY_LOCATION_ID}") {
                  id
                  available
                }
              }
            }
          }
        `,
        variables: {
          variantId: variantGID,
        },
      },
      {
        headers: {
          'X-Shopify-Access-Token': process.env.SHOPIFY_TOKEN,
          'Content-Type': 'application/json',
        },
      }
    );

    const inventoryItem =
      inventoryLevelRes.data?.data?.productVariant?.inventoryItem;

    const inventoryLevelId = inventoryItem?.inventoryLevel?.id;

    if (!inventoryLevelId) {
      throw new Error('inventoryLevelId not found for variant ' + variantId);
    }

    // 2. Adjust inventory quantity
    const adjustRes = await axios.post(
      `https://${process.env.SHOPIFY_SHOP}/admin/api/${process.env.SHOPIFY_API_VERSION}/graphql.json`,
      {
        query: `
          mutation adjustInventory($input: InventoryAdjustQuantityInput!) {
            inventoryAdjustQuantity(input: $input) {
              inventoryLevel {
                id
                available
              }
              userErrors {
                field
                message
              }
            }
          }
        `,
        variables: {
          input: {
            inventoryLevelId,
            availableDelta: delta,
          },
        },
      },
      {
        headers: {
          'X-Shopify-Access-Token': process.env.SHOPIFY_TOKEN,
          'Content-Type': 'application/json',
        },
      }
    );

    const response = adjustRes.data?.data?.inventoryAdjustQuantity;

    if (!response) {
      console.error('Shopify inventoryAdjustQuantity response:', adjustRes.data);
      throw new Error('Invalid response from Shopify inventoryAdjustQuantity');
    }

    if (response.userErrors?.length) {
      throw new Error(response.userErrors[0].message);
    }

    return response.inventoryLevel;
  } catch (err) {
    console.error('Error adjusting inventory:', err.message);
    throw err;
  }
};

// Function to handle the refund request
const refundItem = async (orderId, lineItemId, quantity) => {
  try {
    // Get order to find line item price
    const orderRes = await axios.get(
      `https://${process.env.SHOPIFY_SHOP}/admin/api/${process.env.SHOPIFY_API_VERSION}/orders/${orderId}.json`,
      {
        headers: {
          'X-Shopify-Access-Token': process.env.SHOPIFY_TOKEN
        }
      }
    );

    const order = orderRes.data.order;
    const lineItem = order.line_items.find(item => item.id == lineItemId);
    if (!lineItem) throw new Error("Line item not found in order.");

    const lineItemPrice = parseFloat(lineItem.price);
    const refundAmount = (lineItemPrice * quantity).toFixed(2);

    // Get transactions to link refund to sale
    const transactionsRes = await axios.get(
      `https://${process.env.SHOPIFY_SHOP}/admin/api/${process.env.SHOPIFY_API_VERSION}/orders/${orderId}/transactions.json`,
      {
        headers: {
          'X-Shopify-Access-Token': process.env.SHOPIFY_TOKEN
        }
      }
    );

    const transaction = transactionsRes.data.transactions.find(t => t.kind === 'sale');
    if (!transaction) throw new Error("No sale transaction found.");

    const refundPayload = {
      refund: {
        note: "Refund due to out of stock",
        shipping: { full_refund: false },
        transactions: [
          {
            parent_id: transaction.id,
            amount: refundAmount,
            kind: "refund",
            gateway: transaction.gateway
          }
        ],
        refund_line_items: [
          {
            line_item_id: lineItemId,
            quantity: quantity
          }
        ]
      }
    };
    
    const refundRes = await axios.post(
      `https://${process.env.SHOPIFY_SHOP}/admin/api/${process.env.SHOPIFY_API_VERSION}/orders/${orderId}/refunds.json`,
      refundPayload,
      {
        headers: {
          'X-Shopify-Access-Token': process.env.SHOPIFY_TOKEN,
          "Content-Type": "application/json"
        }
      }
    );

    console.log("✅ Partial refund created:", refundRes.data);
    return refundRes.data;
  } catch (error) {
    console.error("❌ Refund error:", error.response?.data || error.message);
    throw error;
  }
};

module.exports = { getOrders , getProductImageUrl, adjustShopifyInventory, refundItem};
