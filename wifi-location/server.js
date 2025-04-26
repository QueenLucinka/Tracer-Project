const axios = require('axios');
const express = require('express');
const { MongoClient } = require('mongodb');
const cors = require('cors');
const path = require('path');

const uri = '<your_mongodb_connection_string>';
const client = new MongoClient(uri);

const aioUsername = '<yourAIOuserName>';
const aioKey = 'YOUR_ADAFRUIT_IO_KEY';
const wifiMetadataFeed = 'wifi-location-feed';
const googleApiKey = 'YOUR_GOOGLE_MAPS_API_KEY';

const app = express();
const port = 3001;

app.use(express.static(path.join(__dirname, 'public')));
app.use(cors());
app.use(express.json());

client.connect().then(() => {
  console.log('Connected to MongoDB');
}).catch(err => {
  console.error('Failed to connect to MongoDB', err);
});

async function getLastProcessedTimestamp() {
  try {
    const database = client.db('wifi-location');
    const collection = database.collection('last_processed');
    const lastProcessed = await collection.findOne({});
    return lastProcessed ? lastProcessed.timestamp : null;
  } catch (error) {
    console.error('Error fetching last processed timestamp:', error);
    return null;
  }
}

async function saveLastProcessedTimestamp(timestamp) {
  try {
    const database = client.db('wifi-location');
    const collection = database.collection('last_processed');
    await collection.updateOne({}, { $set: { timestamp } }, { upsert: true });
  } catch (error) {
    console.error('Error saving last processed timestamp:', error);
  }
}

async function getWiFiMetadata() {
  try {
    const response = await axios.get(`https://io.adafruit.com/api/v2/{YOUR_USERNAME}/feeds/{YOUR_FEED}/data?limit=30`, {
      headers: { 'X-AIO-Key': '{YOUR_AIO_KEY}' },
    });

    const metadata = response.data;
    const lastProcessedTimestamp = await getLastProcessedTimestamp();
    const lastTimestamp = lastProcessedTimestamp ? new Date(lastProcessedTimestamp) : null;
    const sortedMetadata = metadata.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

    for (const entry of sortedMetadata) {
      const entryTimestamp = new Date(entry.created_at);

      if (!lastTimestamp || entryTimestamp > lastTimestamp) {
        const wifiData = entry.value.split(';').map(entry => {
          const [macAddress, signalStrength] = entry.split(',');
          return { macAddress, signalStrength: parseInt(signalStrength) };
        }).filter(wifi => wifi.macAddress !== '' && !isNaN(wifi.signalStrength));

        await getLocationFromWiFi(wifiData, entry.id, entry.created_at);
        await saveLastProcessedTimestamp(entryTimestamp.toISOString());
      }
    }

  } catch (error) {
    console.error('Error fetching Wi-Fi metadata:', error);
  }
}

app.get('/locations', async (req, res) => {
  try {
    const database = client.db('wifi-location');
    const collection = database.collection('locations');
    const locations = await collection.find({}).toArray();
    res.json(locations);
  } catch (error) {
    console.error('Error fetching location data:', error);
    res.status(500).send('Error fetching location data');
  }
});

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});

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
    const location = response.data;

    const localDate = new Date(adafruitTimestamp);
    const localTime = new Date(localDate.getTime() + 1 * 60 * 60 * 1000);
    const localTimestamp = localTime.toISOString();

    const locationData = {
      entryId: entryId,
      latitude: location.location.lat,
      longitude: location.location.lng,
      timestamp: localTimestamp,
    };

    await saveLocationToMongoDB(locationData);
  } catch (error) {
    console.error(`Error fetching location for entry ID ${entryId}:`, error);
  }
}

async function saveLocationToMongoDB(locationData) {
  try {
    const database = client.db('wifi-location');
    const collection = database.collection('locations');
    await collection.insertOne(locationData);
    console.log('Location saved to MongoDB');
  } catch (error) {
    console.error('Error saving location to MongoDB:', error);
  }
}

getWiFiMetadata();
setInterval(getWiFiMetadata, 60000);