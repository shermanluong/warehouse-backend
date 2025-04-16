# 🧺 Pick & Pack Web App – Backend

This is the backend for a custom **Pick & Pack** web app used for managing grocery warehouse operations. It integrates with **Shopify** and **Locate2U**, supporting picker/packer workflows, barcode scanning, substitutions, labeling, and admin tools.

---

## 🚀 Features

- 📦 Sync unfulfilled orders from **Shopify**
- 🧍 Picker mode: barcode scanning, substitution logic
- 📷 Packer mode: rescan validation, photo capture
- 🔁 Smart substitution system
- 🖨️ Label & packing slip generation (Zebra compatible)
- 🗺️ Locate2U integration: routes, drivers, ETA
- 📊 Admin dashboard-ready: logs, stats, exports
- 🔔 Slack/webhook notifications for events

---

## 🧱 Project Structure
<pre lang="text"> ```
    root/ 
        ├── server.js # Entry point 
        ├── .env # Environment variables 
        ├── package.json # Dependencies & scripts 
        └── src/ 
            ├── app.js # Express app config 
            ├── config/ # Config (Mongo, Shopify, etc.) 
            ├── models/ # Mongoose schemas (Order, User, etc.) 
            ├── routes/ # Express routes by feature 
            ├── controllers/ # Route logic 
            ├── services/ # External API logic (Shopify, Locate2U, Slack) 
            ├── middleware/ # Auth, error handling 
            └── utils/ # Helpers (PDF, barcode validation) ``` 
</pre>

---

## ⚙️ Setup Instructions

### 1. Install Dependencies

```bash
npm install
```

### 2. Create ```.env``` File
```
PORT=5000
MONGO_URI=mongodb://localhost:27017/pickpack

SHOPIFY_SHOP=ritas-farm-produce.myshopify.com
SHOPIFY_TOKEN=your_shopify_private_token
SHOPIFY_API_VERSION=2024-10

LOCATE2U_API_KEY=your_locate2u_api_key
S3_BUCKET_URL=https://your-s3-bucket.amazonaws.com
```

### 3. Run Dev Server
```bash
npm run dev   # With nodemon
```
Or:
```bash
node server.js
```

## 🔌APIs Available
| Route                       | Description                            |
|----------------------------|----------------------------------------|
| `GET /api/shopify/sync-orders` | Sync unfulfilled orders from Shopify    |
| `GET /api/picker/orders`       | Get picker-assigned orders              |
| `POST /api/picker/scan`        | Barcode scan & update                   |
| `GET /api/packer/orders`       | Get picked orders for packer            |
| `POST /api/packer/finalise`    | Confirm pack, upload photo, trigger label |
| `GET /api/admin/logs`          | Admin dashboard stats/logs              |
| `POST /api/webhooks/shopify`   | Shopify webhook endpoint                |
| `POST /api/substitutions`      | Manage substitution rules               |

## 🔐 Role-Based Access (Planned)
- Pickers - Can only access picking-related endpoints.
- Packers - Can only access packing-related endpoints.
- Admins - Can view and manage all.
Use JWT or session-based auth (to be configured).

🧰 Tech Stack
- Node.js + Express - Backend API framework
- MongoDB + Mongoose - NoSQL database & ODM
- Shopify REST & GraphQL APIs - E-commerce order sync, product data, media, etc.
- Locate2U API - Real-time driver tracking & logistics integration
- Slack Webhooks - Internal notifications & alerts
- PDFKit / jsPDF - Packing slip & label generation
- AWS S3 / Local Storage - Product and item photo uploads
- GraphQL Client (graphql-request) - Lightweight GraphQL integration for Shopify media

## 📸 Photo Uploads
Photos are captured at packing time using webcam/tablet and uploaded to:
- AWS S3(preferred)
- or /uploads folder(fallback/local)

---
© 2025 Ritas Farm Produce - Custom Warehouse Ops