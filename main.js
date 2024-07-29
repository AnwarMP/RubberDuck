const { app, BrowserWindow } = require('electron');
const path = require('path');
const noble = require('@abandonware/noble');
const { connectToDeepgram, bufferAudioData, sendAudioToDeepgram } = require('./deepgram');

let recordingTimer;
let codecType = null;

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

    const audioCharacteristic = characteristics.find(c => c.uuid === '19b10001e8f2537e4f6cd104768a1214');
    const codecCharacteristic = characteristics.find(c => c.uuid === '19b10002e8f2537e4f6cd104768a1214');
    const batteryCharacteristic = characteristics.find(c => c.uuid === '2a19');

    if (codecCharacteristic) {
      codecCharacteristic.read((error, data) => {
        if (error) {
          console.error('Codec read error:', error);
        } else {
          codecType = data.readUInt8(0);
          console.log('Codec type:', codecType);

          if (audioCharacteristic) {
            audioCharacteristic.subscribe((error) => {
              if (error) {
                console.error('Subscription error:', error);
                return;
              }
              console.log('Subscribed to audio data notifications');
              connectToDeepgram(); // Connect to Deepgram when ready to receive audio

              // Start recording timer for 5 seconds
              recordingTimer = setTimeout(() => {
                console.log('Recording stopped, sending audio to Deepgram');
                audioCharacteristic.unsubscribe(); // Stop receiving data
                sendAudioToDeepgram(); // Send buffered audio to Deepgram
              }, 5000); // 5 seconds
            });

            audioCharacteristic.on('data', (data, isNotification) => {
              console.log('Audio data received:', data);
              processAudioData(data); // Buffer audio data
            });
          }
        }
      });
    }

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

function processAudioData(data) {
  if (codecType === 1) {
    // PCM 16-bit, 8kHz, mono
    // Ensure the data is properly formatted as a 16-bit PCM buffer
    // The data received here is already in PCM 16-bit, 8kHz, mono format
    bufferAudioData(data);
  } else {
    console.error('Unsupported codec type:', codecType);
    return;
  }
}
