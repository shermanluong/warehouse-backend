// src/controllers/shopify.controller.js
const { getOrders, getProductImageUrl, refundItem } = require('../services/shopify.service');
const Order = require('../models/order.model');
const User  = require('../models/user.model');
const Product = require('../models/product.model'); // Adjust the path
const axios = require('axios');
const { 
  getLocate2uStopsService
} = require('../services/locate2u.service');
const { formatDate } = require('../utils/formateDate');

const assignLeastBusyPicker = async () => {
  const picker = await User.findOne({ role: 'picker', active: true })
    .sort({ 'stats.currentLineItemsAssigned': 1 }) // Least busy first
    .exec();

  return picker;
};

const fetchAndStoreOrders = async (req, res) => {
  const { tripDate } = req.query;
  const orders = await getOrders([formatDate(tripDate)]); // Pull unfulfilled orders from Shopify
  const stops = await getLocate2uStopsService(tripDate);
  console.log("orders count", orders.length);
  console.log("stops count", stops.length);

  const filteredOrders = orders.filter(order => {
    // Check if the orderId exists in the stops array
    const stop = stops.find(s => s.orderId == order.order_number);
    return stop !== undefined; // This will return true if a corresponding stop is found
  });

  for (const order of filteredOrders) {
    const customer = order.customer;
    const picker = await assignLeastBusyPicker();

    const lineItems = order.line_items.map((item) => ({
      shopifyLineItemId: item.id,  
      productId: item.product_id,
      variantId: item.variant_id,
      quantity: item.quantity,
      picked: false,
      packed: false,
      pickedQuantity: 0,
      substitution: null,
      flags: [],
      adminNote: '', // You can populate this manually or from your product DB
      customerNote: item.properties?.find(p => p.name === 'Note')?.value || '',
    }));
    
    const stop = stops.find(s => s.orderId == order.order_number);

    await Order.findOneAndUpdate(
      { shopifyOrderId: order.id },
      {
        $set: {
          shopifyOrderId: order.id,
          name: order.name,
          orderNumber: order.order_number,
          status: 'new',
          tags: order.tags,
          orderNote: order.note, // general order-level customer note
          pickerId: picker._id,
          delivery: stop,
          lineItems,
          customer: customer ? {
            id: customer.id,
            email: customer.email,
            first_name: customer.first_name,
            last_name: customer.last_name,
            phone: customer.phone,
            default_address: customer.default_address ? {
              address1: customer.default_address.address1,
              address2: customer.default_address.address2,
              city: customer.default_address.city,
              province: customer.default_address.province,
              country: customer.default_address.country,
              zip: customer.default_address.zip
            } : {}
          } : null
        }
      },
      { upsert: true }
    );

    const newLineItemCount = order.line_items.reduce((acc, item) => acc + item.quantity, 0);

    await User.findByIdAndUpdate(picker._id, {
      $inc: { 'stats.currentLineItemsAssigned': newLineItemCount }
    });
  }

  res.json({ message: 'Synced', count: filteredOrders.length });
};

const GET_ALL_PRODUCTS_QUERY = `
  query getAllProducts($cursor: String) {
    products(first: 100, after: $cursor) {
      pageInfo {
        hasNextPage
        endCursor
      }
      edges {
        node {
          id
          title
          handle
          vendor
          status
          images(first: 1) {
            edges {
              node {
                originalSrc
                altText
              }
            }
          }
          variants(first: 100) {
            edges {
              node {
                id
                title
                sku
                barcode
                price
                inventoryQuantity
                image {
                  originalSrc
                  altText
                }
              }
            }
          }
        }
      }
    }
  }
`;

const syncAllShopifyProducts = async (req, res) => {
  const shop    = process.env.SHOPIFY_SHOP;
  const token   = process.env.SHOPIFY_TOKEN;
  const version = process.env.SHOPIFY_API_VERSION || '2024-10';

  let hasNextPage = true;
  let cursor = null;

  try {
    while (hasNextPage) {
      const response = await axios.post(
        `https://${shop}/admin/api/${version}/graphql.json`,
        {
          query: GET_ALL_PRODUCTS_QUERY,
          variables: { cursor },
        },
        {
          headers: {
            'X-Shopify-Access-Token': token,
            'Content-Type': 'application/json',
          },
        }
      );

      const products = response.data.data.products;
      for (const edge of products.edges) {
        const p = edge.node;
        const shopifyProductId = p.id.split('/').pop();
        const image = p.images.edges[0]?.node?.originalSrc || '';

        const productDoc = {
          shopifyProductId,
          title: p.title,
          handle: p.handle,
          vendor: p.vendor,
          status: p.status,
          image,
          variants: p.variants.edges.map(({ node }) => ({
            shopifyVariantId: node.id.split('/').pop(),
            title: node.title,
            sku: node.sku,
            barcode: node.barcode,
            price: node.price,
            inventory_quantity: node.inventoryQuantity,
            image: node.image?.originalSrc || '',
          })),
        };

        await Product.findOneAndUpdate(
          { shopifyProductId },
          { $set: productDoc },
          { upsert: true, new: true }
        );
      }

      hasNextPage = products.pageInfo.hasNextPage;
      cursor = products.pageInfo.endCursor;
    }

    res.json({ message: '✅ Finished syncing all products' });

  } catch (error) {
    console.error('Error syncing products:', error?.response?.data || error.message);
    res.status(500).json({ error: '❌ Failed to sync products' });
  }
};

module.exports = { 
  fetchAndStoreOrders,
  syncAllShopifyProducts
};
