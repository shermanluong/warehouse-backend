const crypto = require('crypto');

// Shopify signs the webhook using your app's secret key
const SHOPIFY_SECRET = process.env.SHOPIFY_API_SECRET;

const verifyShopifyWebhook = (req) => {
  const hmacHeader = req.headers['x-shopify-hmac-sha256'];
  const body = req.body.toString();
  const hash = crypto.createHmac('sha256', SHOPIFY_SECRET).update(body, 'utf8').digest('base64');
  return hash === hmacHeader;
};

const handleShopifyWebhook = (req, res) => {
  if (!verifyShopifyWebhook(req)) {
    return res.status(401).send('Unauthorized webhook');
  }

  const topic = req.headers['x-shopify-topic'];
  const shop = req.headers['x-shopify-shop-domain'];
  const payload = JSON.parse(req.body.toString());

  console.log(`📦 Webhook received: ${topic} from ${shop}`);

  // Example: order creation
  if (topic === 'orders/create') {
    // Save or sync order logic here
    console.log('➡️ New order:', payload.id);
  }

  res.status(200).send('Webhook received');
};

module.exports = {
  handleShopifyWebhook
};
