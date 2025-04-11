// src/services/shopify.service.js
const axios = require('axios');

const getOrders = async () => {
    const shop    = process.env.SHOPIFY_SHOP;
    const token   = process.env.SHOPIFY_TOKEN;
    const version = process.env.SHOPIFY_API_VERSION || '2023-10';

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

module.exports = { getOrders };
