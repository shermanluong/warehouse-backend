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

const getOrders = async () => {
    const shop    = process.env.SHOPIFY_SHOP;
    const token   = process.env.SHOPIFY_TOKEN;
    const version = process.env.SHOPIFY_API_VERSION || '2024-10';

    const url = `https://${shop}/admin/api/${version}/orders.json`;
    console.log('SHOPIFY_SHOP_API:', url);

    const res = await axios.get(url, {
        headers: {
            'X-Shopify-Access-Token': token
        },
        params: {
            fulfillment_status: 'unfulfilled',
            limit: 50
        }
    });

    return res.data.orders;
};

module.exports = { getOrders , getProductImageUrl};
