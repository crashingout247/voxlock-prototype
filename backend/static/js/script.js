// static/js/script.js — Clean, no typos, extra debug

console.log("script.js STARTED — file is running");

document.addEventListener('DOMContentLoaded', function() {
  console.log("DOMContentLoaded fired — DOM ready");

  const socket = io();

  console.log("Socket object created");

  const statusEl = document.getElementById('status');
  const chatBox = document.getElementById('chat-box');

  socket.on('connect', function() {
    console.log("Socket.IO CONNECTED successfully");
    if (statusEl) {
      statusEl.textContent = "Status: Connected!";
      statusEl.style.color = "green";
    }
    addMessage('system', 'Connected to VoxLock backend!');
  });

  socket.on('connect_error', function(err) {
    console.error("Socket.IO connection ERROR:", err.message);
    if (statusEl) {
      statusEl.textContent = "Status: Connection failed – " + err.message;
      statusEl.style.color = "red";
    }
    addMessage('error', 'Connection error: ' + err.message);
  });

  socket.on('message', function(msg) {
    console.log("Received 'message' event:", msg.data);
    addMessage('system', msg.data);
  });

  socket.on('transcription', function(data) {
    console.log("Received 'transcription' event:", data);
    addMessage('transcription', data.text || data.data || 'No text field');
  });

  function addMessage(type, text) {
    if (!chatBox) {
      console.warn("No chat-box element found");
      return;
    }
    const div = document.createElement('div');
    div.className = 'msg ' + type;
    div.textContent = text;
    chatBox.appendChild(div);
    chatBox.scrollTop = chatBox.scrollHeight;
    console.log("Added message to chat:", type, text);
  }

  console.log("All listeners attached — waiting for socket events");
});