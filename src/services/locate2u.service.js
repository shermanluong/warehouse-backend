const axios = require('axios');

const getLocate2uTokenService = async () => {
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
  // Trying with a different date (today)
const getLocate2uTripsService = async (tripDate, token) => {
    if (!tripDate) {
        return res.status(400).json({ error: 'Missing "tripDate" query parameter' });
    }

    // Validate the 'tripDate' to ensure it's a valid date
    const date = new Date(tripDate);
    if (isNaN(date)) {
        return res.status(400).json({ error: '"tripDate" parameter is not a valid date' });
    }

    try {
        const response = await axios.get(`${process.env.LOCATE2U_API_BASE_URL}/team/trips/${tripDate}`, {
        headers: {
            'Authorization': `Bearer ${token}`,
            'Accept' : 'application/json'
        }});

        if ( response.status == 200 && response.data) {
            const trips = response.data.map(trip => { 
                return {
                    tripId: trip.tripId, 
                    teamMemberId: trip.assignedTeamMemberId,
                    driverName : trip.assignedTeamMemberName,
                    startTime: trip.startTime,
                    endTime: trip.endTime
                }
            });
            return trips;
        } else {
            console.error('Failed find tripId');
            throw new Error('Failed find tripId');
        }
    } catch (error) {
        console.error('Failed to fetch Locate2u trips:', error.response?.data || error.message);
        throw new Error('Locate2u trips request failed');
    }
};

const getLocate2uTripDetailService = async (tripId, token) => {
    try {
        const response = await axios.get(`${process.env.LOCATE2U_API_BASE_URL}/trips/id/${tripId}`, {
        headers: {
            'Authorization': `Bearer ${token}`,
            'Accept' : 'application/json'
        }
        });

        return response.data;
    } catch (error) {
        console.error('Failed to fetch Locate2u trips:', error.response?.data || error.message);
        throw new Error('Locate2u trips request failed');
    }
};

const getLocate2uStopsService = async (tripDate, token = null) => {
    if (token == null) {
        token = await getLocate2uTokenService();
    }
    const tripDetails = [];
    try {
      const trips = await getLocate2uTripsService(tripDate, token);
  
      // Use for...of to handle async await in the loop
      for (const trip of trips) {
        const tripDetail = await getLocate2uTripDetailService(trip.tripId, token);
        tripDetails.push({
            ...trip,
            stops: tripDetail?.stops || []
        });
      }
  
      return tripDetails;
    } catch (error) {
      console.error('Error fetching stops:', error.message);
      throw new Error('Failed to fetch stops');
    }
};

const addLocate2uStopNoteService = async (stopId, note) => {
    const token = await getLocate2uTokenService();
    
    try {
      const response = await axios.post(
        `${process.env.LOCATE2U_API_BASE_URL}/stops/${stopId}/notes`,
        {
          note: note,
          type: "Stop Note",
          photoFileNames: [],
          documentFileNames: [],
          metadata: null
        },
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/json',
            'Content-Type': 'application/json-patch+json'
          }
        }
      );
  
      return response.data;
    } catch (error) {
      console.error('Error adding note to stop', error.message);
      throw new Error('Failed to add note to stop.');
    }
};

module.exports = { 
    getLocate2uTokenService, 
    getLocate2uTripsService, 
    getLocate2uTripDetailService, 
    getLocate2uStopsService,
    addLocate2uStopNoteService
};
