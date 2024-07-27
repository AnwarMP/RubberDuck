const { app, BrowserWindow } = require('electron');
const path = require('path');
const noble = require('@abandonware/noble');

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js')
    }
  });

  mainWindow.loadFile('index.html');
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

noble.on('stateChange', async (state) => {
  if (state === 'poweredOn') {
    await noble.startScanningAsync([], false);
  } else {
    await noble.stopScanningAsync();
  }
});

noble.on('discover', (peripheral) => {
  if (peripheral.advertisement.localName === 'Friend') {
    noble.stopScanning();
    peripheral.connect((error) => {
      if (error) {
        console.error('Connection error:', error);
        return;
      }
      console.log('Connected to Friend device');
      discoverServicesAndCharacteristics(peripheral);
    });
  }
});
function discoverServicesAndCharacteristics(peripheral) {
    peripheral.discoverAllServicesAndCharacteristics((error, services, characteristics) => {
      if (error) {
        console.error('Service discovery error:', error);
        return;
      }
  
      console.log('Available Services:');
      services.forEach(service => {
        console.log(`Service UUID: ${service.uuid}`);
      });
  
      console.log('Available Characteristics:');
      characteristics.forEach(characteristic => {
        console.log(`Characteristic UUID: ${characteristic.uuid}`);
  
        // Identify and log known characteristics
        switch (characteristic.uuid) {
          case '19b10001e8f2537e4f6cd104768a1214':
            console.log(' - Audio Data Characteristic');
            break;
          case '19b10002e8f2537e4f6cd104768a1214':
            console.log(' - Codec Type Characteristic');
            break;
          case '19b10003e8f2537e4f6cd104768a1214':
            console.log(' - Unknown Characteristic');
            break;
          case '2a19':
            console.log(' - Battery Level Characteristic');
            break;
          default:
            console.log(' - Unknown Characteristic');
        }
      });
  
      // Find the characteristics
      const audioCharacteristic = characteristics.find(c => c.uuid === '19b10001e8f2537e4f6cd104768a1214');
      const codecCharacteristic = characteristics.find(c => c.uuid === '19b10002e8f2537e4f6cd104768a1214');
      const batteryCharacteristic = characteristics.find(c => c.uuid === '2a19');
  
      // Read and log codec type
      if (codecCharacteristic) {
        codecCharacteristic.read((error, data) => {
          if (error) {
            console.error('Codec read error:', error);
          } else {
            const codecType = data.readUInt8(0);
            console.log('Codec type:', codecType);
          }
        });
      }
  
      // Subscribe to audio data notifications
      if (audioCharacteristic) {
        audioCharacteristic.subscribe((error) => {
          if (error) {
            console.error('Subscription error:', error);
            return;
          }
          console.log('Subscribed to audio data notifications');
        });
  
        audioCharacteristic.on('data', (data, isNotification) => {
          console.log('Audio data received:', data);
          // Process audio data here
        });
      }
  
      // Read and log battery level
      if (batteryCharacteristic) {
        batteryCharacteristic.read((error, data) => {
          if (error) {
            console.error('Battery level read error:', error);
          } else {
            const batteryLevel = data.readUInt8(0);
            console.log('Battery level:', batteryLevel);
          }
        });
  
        batteryCharacteristic.subscribe((error) => {
          if (error) {
            console.error('Battery level subscription error:', error);
          } else {
            console.log('Subscribed to battery level notifications');
          }
        });
  
        batteryCharacteristic.on('data', (data, isNotification) => {
          const batteryLevel = data.readUInt8(0);
          console.log('Battery level notification:', batteryLevel);
        });
      }
    });
  }
  
  
