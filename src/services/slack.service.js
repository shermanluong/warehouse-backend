// services/slack.service.js
const axios = require('axios');

const sendSlackNotification = async (text) => {
    const webHookUrl = process.env.SLACK_WEBHOOK_URL;

    const payload = {
        text, // Basic text message
        // use blocks or attachments for rich formatting.
    };

    try {
        await axios.post(webHookUrl, payload);
    } catch (error) {   
        console.error('Slack notification failed', error.response?.data || error.message);
    };
}

module.exports = {
    sendSlackNotification
}