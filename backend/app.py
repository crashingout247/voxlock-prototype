from flask import Flask, request, jsonify
from flask_cors import CORS
import base64
from io import BytesIO
import numpy as np
import cv2
import wave

app = Flask(__name__)
CORS(app)  # Allow frontend from different origin/port to call this backend

# Root route so http://127.0.0.1:5000 shows something useful (no more 404)
@app.route('/', methods=['GET'])
def home():
    return jsonify({
        "message": "Voice + Video Processing Backend is running!",
        "endpoints": {
            "/process": "POST - Send base64 frame & get isolated audio (prototype)"
        },
        "status": "ok"
    })

# Main processing endpoint (expects base64 image frame from frontend)
@app.route('/process', methods=['POST'])
def process():
    try:
        # Get base64 data from JSON body
        data = request.json['frame']

        # Remove data URL prefix if present (data:image/jpeg;base64,...)
        if ',' in data:
            img_data = base64.b64decode(data.split(',')[1])
        else:
            img_data = base64.b64decode(data)

        # Convert to OpenCV image
        nparr = np.frombuffer(img_data, np.uint8)
        frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

        if frame is None:
            return jsonify({"error": "Invalid image data"}), 400

        # Placeholder: Basic image processing (e.g. grayscale)
        # Later: add lip/face detection to guide voice separation
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)

        # Mock audio generation (replace this with real Asteroid model later)
        sample_rate = 16000
        y = np.random.rand(sample_rate).astype(np.float32)  # random noise
        y = (y * 32767).astype(np.int16)                    # to 16-bit

        # Simple high-pass filter (basic noise reduction simulation)
        high_pass = np.diff(y, prepend=y[0])

        # Create WAV in memory
        buffer = BytesIO()
        with wave.open(buffer, 'wb') as wf:
            wf.setnchannels(1)          # mono
            wf.setsampwidth(2)          # 16-bit
            wf.setframerate(sample_rate)
            wf.writeframes(high_pass.tobytes())

        # Encode to base64 string
        isolated_audio_base64 = base64.b64encode(buffer.getvalue()).decode('utf-8')

        return jsonify({
            'status': 'success',
            'isolated_audio': f"data:audio/wav;base64,{isolated_audio_base64}"
            # You can add more: e.g. "lip_detected": True, "confidence": 0.85
        })

    except Exception as e:
        return jsonify({"error": str(e)}), 500


if __name__ == '__main__':
    app.run(debug=True, port=5000, host='0.0.0.0')  # host='0.0.0.0' allows network access if needed
    from flask_socketio import SocketIO, emit

socketio = SocketIO(app)

@socketio.on('audio_chunk')
def handle_audio_chunk(data):
    # data is raw audio bytes from frontend
    print("Received audio chunk:", len(data), "bytes")
    # TODO: process with model, send back cleaned
    cleaned = data  # placeholder
    emit('cleaned_audio', cleaned)  # send back to frontend

if __name__ == '__main__':
    socketio.run(app, debug=True, port=5000, host='0.0.0.0')