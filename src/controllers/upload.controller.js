const axios = require('axios');
const FormData = require('form-data');

const uploadImage = async (req, res) => {
    try {
      const { fileBase64, fileName } = req.body;
  
      const form = new FormData();
      form.append("file", fileBase64); // full base64 string including prefix
      form.append("fileName", fileName);
      form.append("folder", "order-photos");
  
      const imagekitRes = await axios.post(
        "https://upload.imagekit.io/api/v1/files/upload",
        form,
        {
          headers: {
            ...form.getHeaders(),
            Authorization: `Basic ${Buffer.from(process.env.IMAGEKIT_PRIVATE_KEY + ":").toString('base64')}`,
          }
        }
      );
  
      res.json({ url: imagekitRes.data.url });
    } catch (err) {
      console.error("ImageKit Upload Error:", err.response?.data || err.message);
      res.status(500).json({ error: "Upload failed" });
    }
};

module.exports = {
    uploadImage
};
