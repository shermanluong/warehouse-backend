const axios = require('axios');

getLocate2uToken = async () => {
    const params = new URLSearchParams();
    params.append('client_id', process.env.LOCATE2U_CLIENT_ID);
    params.append('client_secret', process.env.LOCATE2U_CLIENT_SECRET);
    params.append('grant_type', 'client_credentials');
    params.append('scope', 'locate2u.api');
    
    try {
        const response = await axios.post('https://id.locate2u.com/connect/token', params, {
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
        }
        });

        return response.data.access_token;
    } catch (error) {
        console.error('Failed to fetch Locate2u token:', error.response?.data || error.message);
        throw new Error('Locate2u token request failed');
    }
}

module.exports = { getLocate2uToken };
