#include <Arduino.h>
#define TINY_GSM_MODEM_SIM7000  // Specify the modem model
#include <TinyGsmClient.h>      // Include the TinyGSM library for GSM communication
#include <PubSubClient.h>       // Include the PubSubClient library for MQTT
#include <WiFi.h>
#include <WifiLocation.h>       // Include the WifiLocation library for location fetching

// User-specific credentials (replace 'YourUsername' with the actual username)
const char* aioUsername = "<YourUsername>";  // Placeholder for dynamic username input
const char* aioKey = "<YourAdafruitIOKey>";  // Your Adafruit IO key (replace with actual)

// MQTT broker settings for Adafruit IO
const char* broker = "io.adafruit.com";
const int mqttPort = 1883;
const char* WiFiMetadataTopic = "<YourUsername>/feeds/<your-feed>"; // Replace with actual feed name

// APN settings for the modem
const char apn[] = "<your_APN>";  // APN for the cellular network
const char gprsUser[] = "";  // Optional username for GPRS
const char gprsPass[] = "";  // Optional password for GPRS

// Create instances for GSM and MQTT clients
TinyGsm modem(Serial1);                  // Create a TinyGSM object for communication with the GSM modem
TinyGsmClient gsmClient(modem);          // Create a GSM client object
PubSubClient mqttClient(gsmClient);      // Create an MQTT client object

// Pin definitions
#define PWR_PIN 4                       // Power control pin for the modem
#define UART_BAUD 9600                  // Baud rate for serial communication
#define PIN_RX 26                       // RX pin for UART
#define PIN_TX 27                       // TX pin for UART

// Google API Key for Wi-Fi location (replace with your actual key)
const char* googleApiKey = "<YourGoogleAPIKey>";

// WifiLocation object for location fetching (uses Google API for location data)
WifiLocation location(googleApiKey);

// Function to power on the modem
void modemPowerOn() {
    pinMode(PWR_PIN, OUTPUT);          // Set the power pin as output
    digitalWrite(PWR_PIN, LOW);        // Turn on the modem by setting the pin low
    delay(1000);                       // Wait for a second
    digitalWrite(PWR_PIN, HIGH);       // Turn off the modem by setting the pin high
}

// Function to connect to the MQTT broker
boolean mqttConnect() {
    boolean status = mqttClient.connect(aioUsername, aioUsername, aioKey); // Use the username for connection
    return status;
}

// Function to scan Wi-Fi networks and collect metadata
void scanWiFiNetworks(String &wifiData) {
    WiFi.mode(WIFI_STA);                // Set the Wi-Fi mode to station (client)
    WiFi.disconnect();                  // Disconnect from any current Wi-Fi network
    delay(100);                         // Wait for 100ms

    int n = WiFi.scanNetworks();        // Scan for available Wi-Fi networks
    for (int i = 0; i < n; i++) {      // Loop through all networks
        String bssid = WiFi.BSSIDstr(i); // Get the BSSID (MAC address) of the network
        int rssi = WiFi.RSSI(i);         // Get the signal strength (RSSI) of the network
        wifiData += bssid + "," + String(rssi) + ";";  // Append the network data to wifiData
    }
    WiFi.scanDelete();                  // Delete the scan results to free up memory
}

// Function to publish Wi-Fi metadata via MQTT
void publishWiFiMetadata() {
    String wifiData = "";              // Initialize an empty string for Wi-Fi data
    scanWiFiNetworks(wifiData);        // Scan for networks and populate wifiData

    if (!wifiData.isEmpty()) {        // If there's any data, publish it
        mqttClient.publish(WiFiMetadataTopic, wifiData.c_str());  // Publish to the MQTT broker
    }
}

void setup() {
    // Initialize communication
    modemPowerOn();    // Power on the GSM modem

    // Initialize Serial1 for communication with the modem (RX, TX pins specified)
    Serial1.begin(UART_BAUD, SERIAL_8N1, PIN_RX, PIN_TX);

    if (!modem.restart()) {  // Restart the modem and check if it works
        while (true);  // Halt the system if the modem doesn't restart successfully
    }

    if (!modem.waitForNetwork(60000L)) {  // Wait for the network to be registered
        while (true);  // Halt if the network registration fails
    }

    if (!modem.gprsConnect(apn, gprsUser, gprsPass)) {  // Connect to the GPRS network
        while (true);  // Halt if GPRS connection fails
    }

    mqttClient.setServer(broker, mqttPort); // Set the MQTT broker and port
    mqttConnect(); // Establish an MQTT connection
}

void loop() {
    if (!mqttClient.connected()) {      // Check if the MQTT client is connected
        mqttConnect();                   // Reconnect if not
    }

    // Publish Wi-Fi metadata every 30 seconds
    publishWiFiMetadata();

    delay(30000);  // Wait for 30 seconds before the next iteration
    mqttClient.loop();  // Process incoming MQTT messages
}
