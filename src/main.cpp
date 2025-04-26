#include <Arduino.h>
#define TINY_GSM_MODEM_SIM7000
#include <TinyGsmClient.h>
#include <PubSubClient.h>
#include <WiFi.h>
#include <WifiLocation.h>

const char* aioUsername = "<YourUsername>";
const char* aioKey = "<YourAdafruitIOKey>";
const char* broker = "io.adafruit.com";
const int mqttPort = 1883;
const char* WiFiMetadataTopic = "<YourUsername>/feeds/<your-feed>";

const char apn[] = "<your_APN>";
const char gprsUser[] = "";
const char gprsPass[] = "";

TinyGsm modem(Serial1);
TinyGsmClient gsmClient(modem);
PubSubClient mqttClient(gsmClient);

#define PWR_PIN 4
#define UART_BAUD 9600
#define PIN_RX 26
#define PIN_TX 27

const char* googleApiKey = "<YourGoogleAPIKey>";
WifiLocation location(googleApiKey);

void modemPowerOn() {
    pinMode(PWR_PIN, OUTPUT);
    digitalWrite(PWR_PIN, LOW);
    delay(1000);
    digitalWrite(PWR_PIN, HIGH);
}

boolean mqttConnect() {
    return mqttClient.connect(aioUsername, aioUsername, aioKey);
}

void scanWiFiNetworks(String &wifiData) {
    WiFi.mode(WIFI_STA);
    WiFi.disconnect();
    delay(100);

    int n = WiFi.scanNetworks();
    for (int i = 0; i < n; i++) {
        String bssid = WiFi.BSSIDstr(i);
        int rssi = WiFi.RSSI(i);
        wifiData += bssid + "," + String(rssi) + ";";
    }
    WiFi.scanDelete();
}

void publishWiFiMetadata() {
    String wifiData;
    scanWiFiNetworks(wifiData);
    if (!wifiData.isEmpty()) {
        mqttClient.publish(WiFiMetadataTopic, wifiData.c_str());
    }
}

void setup() {
    modemPowerOn();
    Serial1.begin(UART_BAUD, SERIAL_8N1, PIN_RX, PIN_TX);

    if (!modem.restart()) {
        while (true);
    }

    if (!modem.waitForNetwork(60000L)) {
        while (true);
    }

    if (!modem.gprsConnect(apn, gprsUser, gprsPass)) {
        while (true);
    }

    mqttClient.setServer(broker, mqttPort);
    mqttConnect();
}

void loop() {
    if (!mqttClient.connected()) {
        mqttConnect();
    }

    publishWiFiMetadata();
    delay(30000);
    mqttClient.loop();
}
