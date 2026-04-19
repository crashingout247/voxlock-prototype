import eventlet
eventlet.monkey_patch()

from flask import Flask, render_template
from flask_socketio import SocketIO, emit
import numpy as np

app = Flask(__name__, template_folder='../frontend', static_folder='../frontend', static_url_path='')
# Enable CORS so the browser can talk to the server
socketio = SocketIO(app, cors_allowed_origins="*")

# Global variable to store what the hands are doing
current_gesture = "none"

@app.route('/')
def index():
    return render_template('index.html')

@socketio.on('connect')
def handle_connect():
    print("Frontend connected successfully via Socket.IO!")

# Listens for the hand signal from script.js
@socketio.on('gesture_state')
def handle_gesture(gesture):
    global current_gesture
    current_gesture = gesture

@socketio.on('audio_stream')
def handle_audio_stream(data):
    global current_gesture
    
    # 1. IMMEDIATE MUTE (Fist)
    if current_gesture == 'fist':
        # Don't send anything back. This effectively mutes the user.
        return 
        
    # 2. DYNAMIC NOISE GATE
    audio_array = np.frombuffer(data, dtype=np.float32)
    volume = np.max(np.abs(audio_array))
    
    # Normal listening vs strict noise reduction
    base_threshold = 0.05 
    enhanced_threshold = 0.15 # 3x stricter for palm_down
    
    # If the palm is down, use the strict threshold to cut out noise
    current_threshold = enhanced_threshold if current_gesture == 'palm_down' else base_threshold
    
    if volume < current_threshold:
        return # Drop the audio because it's just background noise

    # 3. PLAYBACK
    # Send the clean audio back to the browser to be heard
    emit('audio_playback', data)

@socketio.on('lip_data')
def handle_lip_data(data):
    # This securely receives the locked-on target's lips for future logic
    pass

if __name__ == '__main__':
    socketio.run(app, host='0.0.0.0', port=8080, debug=True)