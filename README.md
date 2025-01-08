# TRACER Project

## Project Overview
The **TRACER Project** is designed to track and visualize the movements of a pet (Bruno) using a GPS-based tracking system. The system uses an ESP32 device to send Wi-Fi data and location updates to a server. The server stores the data in MongoDB, and the front end uses Leaflet.js to visualize the data on a map. The project also integrates geofencing and allows users to check the real-time location of Bruno as well as historical data.

## Project Structure

The project is organized into the following directories:

### `docs/`
Contains project documentation and reports.
- **`Project_Report.pdf`**: A detailed report about the project, including the methodology, components, and implementation details.
- **`Diary of Improvements.pdf`**: A diary documenting the development process, challenges faced, and solutions implemented.

### `src/`
Contains the source code for the ESP32 device that collects Wi-Fi data and determines the location using Google’s Geolocation API.
- **`main.cpp`**: The main source file for the ESP32, responsible for Wi-Fi scanning, location fetching, and sending data to the MQTT broker.

### `wifi-location/`
Contains the server-side code and front-end components.
- **`server.js`**: The Node.js server that serves the front-end and interacts with MongoDB to fetch and store location data.
  - The server listens for incoming HTTP requests and sends the location data from MongoDB to the front end.
- **`public/`**: The front-end files, including HTML, CSS, and JavaScript files that provide an interface to view Bruno's location.
  - **`index.html`**: The homepage of the application, which provides the user interface to interact with the system.
  - **`map_last_pos.html`**: A page that shows Bruno’s most recent position.
  - **`map_history.html`**: A page that shows the historical data of Bruno's movement on a map.

## Technologies Used
- **ESP32**: A low-power microcontroller used to capture Wi-Fi signals and determine the location of Bruno.
- **Adafruit IO**: Used for storing the Wi-Fi metadata.
- **Google Maps API**: Used for retrieving Bruno's geographical location based on Wi-Fi access points.
- **MongoDB**: Used to store and manage location data for Bruno.
- **Node.js**: Runs the server-side logic, including fetching Wi-Fi metadata, interacting with MongoDB, and serving the front-end pages.
- **Leaflet.js**: Used for rendering maps and visualizing Bruno's location on the front end.

## How to Run the Project

### 1. **Set up the ESP32 device**:
   - Flash the `main.cpp` to the ESP32 device.
   - Make sure the ESP32 is connected to the internet and can communicate with Adafruit IO and the MQTT broker.
   - Configure the Wi-Fi settings and the MQTT credentials in the `main.cpp` file.

### 2. **Set up the server**:
   - Navigate to the `wifi-location/` directory.
   - Install necessary Node.js dependencies by running the following command:
     ```bash
     npm install
     ```
   - Start the server by running:
     ```bash
     node server.js
     ```
   - The server will run on `http://localhost:3001`, and you can access the front-end pages.

### 3. **Access the Front-End**:
   - Open your browser and visit the following URLs:
     - `http://localhost:3001`: The main page with links to view the last position and history of Bruno.
     - `http://localhost:3001/map_last_pos.html`: To view Bruno's last position.
     - `http://localhost:3001/map_history.html`: To view Bruno's historical location data.

## Conclusion
This project allows you to track the movement of Bruno and visualize his path on a map. The integration of geofencing ensures you can monitor when Bruno moves outside the defined area. The system is built using modern technologies and can be expanded for various tracking applications.



