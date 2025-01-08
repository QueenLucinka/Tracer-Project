const axios = require('axios');
const express = require('express');
const { MongoClient } = require('mongodb');
const cors = require('cors');
const path = require('path');  // Add path module to serve static files

// MongoDB URI and settings - Replace with your secure connection details
const uri = '<your_mongodb_connection_string>';  // MongoDB connection string
const client = new MongoClient(uri);  // Create the MongoDB client instance

const aioUsername = '<yourAIOuserName>';
const aioKey = 'YOUR_ADAFRUIT_IO_KEY';
const wifiMetadataFeed = 'wifi-location-feed';
const googleApiKey = 'YOUR_GOOGLE_MAPS_API_KEY';

// Create an express app instance
const app = express();
const port = 3001;  // Port number for the express server

// Serve static files from 'public' folder
app.use(express.static(path.join(__dirname, 'public')));

// Use CORS middleware to allow cross-origin requests
app.use(cors());  // Enable Cross-Origin Resource Sharing
app.use(express.json());  // Middleware to parse JSON bodies

// Connect to MongoDB
client.connect().then(() => {
  console.log('Connected to MongoDB');
}).catch(err => {
  console.error('Failed to connect to MongoDB', err);
});

// Function to retrieve the last processed timestamp from MongoDB
async function getLastProcessedTimestamp() {
  try {
    const database = client.db('wifi-location');  // Specify the database
    const collection = database.collection('last_processed');  // Collection storing the last processed timestamp
    const lastProcessed = await collection.findOne({});
    return lastProcessed ? lastProcessed.timestamp : null;
  } catch (error) {
    console.error('Error fetching last processed timestamp:', error);
    return null;  // Return null if there's an error fetching the timestamp
  }
}

// Function to save the last processed timestamp in MongoDB
async function saveLastProcessedTimestamp(timestamp) {
  try {
    const database = client.db('wifi-location');
    const collection = database.collection('last_processed');
    await collection.updateOne({}, { $set: { timestamp } }, { upsert: true });
  } catch (error) {
    console.error('Error saving last processed timestamp:', error);
  }
}

// Function to fetch Wi-Fi metadata from an external source (Adafruit IO)
async function getWiFiMetadata() {
  try {
    const response = await axios.get(`https://io.adafruit.com/api/v2/{YOUR_USERNAME}/feeds/{YOUR_FEED}/data?limit=30`, {
      headers: { 'X-AIO-Key': '{YOUR_AIO_KEY}' },  // Adafruit IO Key for authentication
    });
    const metadata = response.data;  // Wi-Fi metadata from Adafruit IO

    // Retrieve the last processed timestamp from MongoDB
    const lastProcessedTimestamp = await getLastProcessedTimestamp();
    const lastTimestamp = lastProcessedTimestamp ? new Date(lastProcessedTimestamp) : null;

    // Sort metadata by the 'created_at' field from oldest to newest
    const sortedMetadata = metadata.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

    // Process each metadata entry
    for (const entry of sortedMetadata) {
      const entryTimestamp = new Date(entry.created_at);

      // Only process entries that are newer than the last processed timestamp
      if (!lastTimestamp || entryTimestamp > lastTimestamp) {
        const wifiData = entry.value.split(';').map(entry => {
          const [macAddress, signalStrength] = entry.split(',');
          return { macAddress, signalStrength: parseInt(signalStrength) };
        }).filter(wifi => wifi.macAddress !== '' && !isNaN(wifi.signalStrength));

        // Convert Wi-Fi metadata to a location and store it in MongoDB
        await getLocationFromWiFi(wifiData, entry.id, entry.created_at);

        // Save the latest timestamp after processing each entry
        await saveLastProcessedTimestamp(entryTimestamp.toISOString());
      }
    }

  } catch (error) {
    console.error('Error fetching Wi-Fi metadata:', error);
  }
}

// Route to fetch location data from MongoDB
app.get('/locations', async (req, res) => {
  try {
    const database = client.db('wifi-location');
    const collection = database.collection('locations');
    const locations = await collection.find({}).toArray();  // Retrieve all locations from MongoDB
    res.json(locations);  // Send the locations as a JSON response
  } catch (error) {
    console.error('Error fetching location data:', error);
    res.status(500).send('Error fetching location data');  // Send an error response if there's an issue
  }
});

// Start the server and listen on the specified port
app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});

// Function to convert Wi-Fi metadata into location using the Google Maps Geolocation API
async function getLocationFromWiFi(wifiData, entryId, adafruitTimestamp) {
  const url = `https://www.googleapis.com/geolocation/v1/geolocate?key={YOUR_GOOGLE_API_KEY}`;
  const payload = {
    wifiAccessPoints: wifiData.map(wifi => ({
      macAddress: wifi.macAddress,
      signalStrength: wifi.signalStrength,
    })),
  };

  try {
    const response = await axios.post(url, payload);
    const location = response.data;  // Location data returned by the Google API
    console.log(`Location for entry ID ${entryId}:`);
    console.log('Latitude:', location.location.lat);
    console.log('Longitude:', location.location.lng);

    // Store the location data in MongoDB with an adjusted timestamp
    const localDate = new Date(adafruitTimestamp);  // Adjust the timestamp based on Adafruit IO timestamp
    const localTime = new Date(localDate.getTime() + 1 * 60 * 60 * 1000);  // Add 1 hour to adjust for time zone
    const localTimestamp = localTime.toISOString();  // Store the timestamp in ISO format

    const locationData = {
      entryId: entryId,
      latitude: location.location.lat,
      longitude: location.location.lng,
      timestamp: localTimestamp,
    };

    // Save location data to MongoDB
    await saveLocationToMongoDB(locationData);
  } catch (error) {
    console.error(`Error fetching location for entry ID ${entryId}:`, error);
  }
}

// Function to save location data to MongoDB
async function saveLocationToMongoDB(locationData) {
  try {
    const database = client.db('wifi-location');
    const collection = database.collection('locations');
    await collection.insertOne(locationData);  // Insert the location data into MongoDB
    console.log('Location saved to MongoDB');
  } catch (error) {
    console.error('Error saving location to MongoDB:', error);
  }
}

// Start the metadata fetch process immediately
getWiFiMetadata();  // Fetch Wi-Fi metadata and process it

// Run the process every 60 seconds to fetch and process new metadata
setInterval(getWiFiMetadata, 60000);
