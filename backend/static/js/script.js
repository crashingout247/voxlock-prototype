document.addEventListener('DOMContentLoaded', () => {
  console.log("script.js loaded - attempting Socket.IO connection");

  // Connect to the current host/port (Flask server)
  const socket = io();  // auto-detects http://127.0.0.1:5000

  const statusEl = document.getElementById('status');
  const chatBox = document.getElementById('chat-box');

  // Connection success
  socket.on('connect', () => {
    console.log("Socket.IO connected successfully!");
    if (statusEl) {
      statusEl.textContent = "Status: Connected!";
      statusEl.style.color = "green";
    }
    addMessage('system', 'Connected to VoxLock backend!');
  });

  // Connection error
  socket.on('connect_error', (err) => {
    console.error("Socket.IO connection error:", err.message);
    if (statusEl) {
      statusEl.textContent = "Status: Connection failed - " + err.message;
      statusEl.style.color = "red";
    }
    addMessage('error', 'Connection error: ' + err.message);
  });

  // Receive test message from server
  socket.on('message', (msg) => {
    console.log("Received message:", msg.data);
    addMessage('system', msg.data);
  });

  // Receive real-time transcription
  socket.on('transcription', (data) => {
    console.log("Received transcription:", data.text);
    addMessage('transcription', data.text);
  });

  // Helper to add message to chat
  function addMessage(type, text) {
    if (!chatBox) return;
    const div = document.createElement('div');
    div.className = `msg ${type}`;
    div.textContent = text;
    chatBox.appendChild(div);
    chatBox.scrollTop = chatBox.scrollHeight;
  }

  console.log("Socket.IO setup complete - waiting for connection...");
});