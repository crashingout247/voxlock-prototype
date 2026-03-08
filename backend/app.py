from flask import Flask, render_template
from flask_cors import CORS
from flask_socketio import SocketIO, emit
import threading

app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "*"}})
socketio = SocketIO(app, cors_allowed_origins="*", async_mode='threading')

@socketio.on('connect')
def handle_connect():
    print('Client connected via Socket.IO')
    emit('message', {'data': 'Connected to VoxLock backend!'})

@socketio.on('message')
def handle_message(data):
    print('Received message:', data)
    emit('message', {'data': f'Echo: {data}'}, broadcast=True)

def broadcast_transcription(text):
    socketio.emit('transcription', {'text': text})
    print(f"[Broadcast] Sent to frontend: {text}")

@app.route('/')
def home():
    return render_template('index.html')

if __name__ == '__main__':
    print("Starting VoxLock backend...")

    # Import listener AFTER Flask setup (avoids blocking during import)
    from audio_processing import start_listening

    # Start audio listener in background
    listener_thread = threading.Thread(target=start_listening, daemon=True)
    listener_thread.start()

    print("Audio listener started in background thread")

    socketio.run(app, host='0.0.0.0', port=5000, debug=True, allow_unsafe_werkzeug=True)