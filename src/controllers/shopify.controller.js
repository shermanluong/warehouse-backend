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
  const tripDate = req.query.tripDate;
  const driversRaw = req.query.driver || req.query['driver[]'];
    const drivers = Array.isArray(driversRaw)
      ? driversRaw
      : driversRaw
        ? [driversRaw]
        : [];

    const tagsRaw = req.query.tag || req.query['tag[]'];
    const tags = Array.isArray(tagsRaw)
      ? tagsRaw
      : tagsRaw
        ? [tagsRaw]
        : [];

  const orders = await getOrders([formatDate(tripDate)]); // Pull unfulfilled orders from Shopify
  const tripDetails = await getLocate2uStopsService(tripDate);

  let count = 0;

  for (const tripDetail of tripDetails) {
    if (drivers.length === 0 || drivers.includes(tripDetail.teamMemberId)) {
      for (const stop of tripDetail.stops) {
        const order = orders.find(o => {
          const orderIdMatch = o.order_number == stop?.customFields?.orderid;
          const tagMatch = tags.length === 0 || tags.some(tag =>
            new RegExp(`(?:^|,\\s*)${tag}(?:,|$)`, 'i').test(o.tags || '')
          );
          return orderIdMatch && tagMatch;
        });

        if (order) {
          const customer = order.customer;
          const picker = await assignLeastBusyPicker();

          const delivery = {
            driverName: tripDetail?.driverName,
            driverMemberId: tripDetail?.teamMemberId,
            tripId: tripDetail?.tripId,
            stopId: stop?.stopId,
            stopNumber: stop?.order,
            startTime: tripDetail?.startTime,
            endTime: tripDetail?.endTime,
          };

          const lineItems = order.line_items.map((item) => ({
            shopifyLineItemId: item.id,
            productId: item.product_id,
            variantId: item.variant_id,
            quantity: item.quantity,
            picked: false,
            packed: false,
            pickedStatus: {
              verified: { quantity: 0 },
              damagedQuantity: { quantity: 0 },
              outOfStockQuantity: { quantity: 0 }
            },
            packedStatus: {
              verified: { quantity: 0 },
              damagedQuantity: { quantity: 0 },
              outOfStockQuantity: { quantity: 0 }
            },
            substitution: null,
            flags: [],
            adminNote: '',
            customerNote: item.properties?.find(p => p.name === 'Note')?.value || '',
          }));

          await Order.findOneAndUpdate(
            { shopifyOrderId: order.id },
            {
              $set: {
                shopifyOrderId: order.id,
                name: order.name,
                orderNumber: order.order_number,
                status: 'new',
                tags: order.tags,
                orderNote: order.note,
                pickerId: picker._id,
                delivery,
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

          count++;
        }
      }
    }
  }

  res.json({ message: 'Synced', count });
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

      // Check if response is valid
      if (!response?.data?.data?.products) {
        console.error('Invalid response:', response?.data);
        break;
      }

      const products = response.data.data.products;

      // Loop through all product edges
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

      // Check for next page
      hasNextPage = products.pageInfo.hasNextPage;
      cursor = products.pageInfo.endCursor;

      // Add a delay between requests to avoid hitting API rate limits (e.g., 1 second)
      if (hasNextPage) {
        await new Promise(resolve => setTimeout(resolve, 1000)); // Delay of 1 second
      }
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
