const WebSocket = require('ws');

const DEEPGRAM_API_KEY = '15c9e17e10b6010fa711f376c9c07bbd66ab5edc'; // Replace with your Deepgram API key
const DEEPGRAM_URL = 'wss://api.deepgram.com/v1/listen';

let socket;
let audioBuffer = [];
let isConnected = false;
let reconnectAttempts = 0;
const maxReconnectAttempts = 10;

function connectToDeepgram() {
  socket = new WebSocket(DEEPGRAM_URL, {
    headers: {
      'Authorization': `Token ${DEEPGRAM_API_KEY}`,
    }
  });

  socket.onopen = () => {
    console.log('Connected to Deepgram');
    isConnected = true;
    reconnectAttempts = 0;
    // Send any buffered audio data
    if (audioBuffer.length > 0) {
      sendAudioToDeepgram();
    }
  };

  socket.onmessage = (message) => {
    try {
      const received = JSON.parse(message.data);
      console.log('Received message:', received);

      if (received.type === 'Metadata') {
        console.log('Received metadata:', received);
      } else if (received.type === 'Utterance') {
        const transcript = received.channel.alternatives[0]?.transcript;
        if (transcript && received.is_final) {
          console.log('Transcription:', transcript);
          // You can also emit an event or update the UI with the transcript here
        }
      }
    } catch (error) {
      console.error('Error processing message:', error);
    }
  };

  socket.onclose = () => {
    console.log('Disconnected from Deepgram');
    isConnected = false;
    // Attempt to reconnect after a delay
    if (reconnectAttempts < maxReconnectAttempts) {
      reconnectAttempts++;
      console.log(`Reconnection attempt ${reconnectAttempts}/${maxReconnectAttempts}`);
      setTimeout(connectToDeepgram, 1000);
    } else {
      console.error('Max reconnection attempts reached. Could not reconnect to Deepgram.');
    }
  };

  socket.onerror = (error) => {
    console.error('Deepgram error:', error);
  };
}

function sendAudioToDeepgram() {
  if (socket && socket.readyState === WebSocket.OPEN) {
    const audioData = Buffer.concat(audioBuffer);
    socket.send(audioData);
    audioBuffer = []; // Clear the buffer after sending
  }
}

function bufferAudioData(data) {
  audioBuffer.push(data);
  if (isConnected) {
    sendAudioToDeepgram();
  }
}

module.exports = {
  connectToDeepgram,
  bufferAudioData,
  sendAudioToDeepgram,
};
