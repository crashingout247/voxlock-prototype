from flask import Flask, request, jsonify
from flask_cors import CORS
import base64
from io import BytesIO
import numpy as np
import cv2
import wave

app = Flask(__name__)
CORS(app)

@app.route('/')
def home():
    return jsonify({
        "message": "Voice + Video Processing Backend is running!",
        "endpoints": {
            "/process": "POST - Send base64 frame & get isolated audio (prototype)"
        },
        "status": "ok"
    })

@app.route('/process', methods=['POST'])
def process():
    try:
        data = request.json['frame']
        
        if ',' in data:
            img_data = base64.b64decode(data.split(',')[1])
        else:
            img_data = base64.b64decode(data)

        nparr = np.frombuffer(img_data, np.uint8)
        frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

        if frame is None:
            return jsonify({"error": "Invalid image data"}), 400

        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)

        sample_rate = 16000
        y = np.random.rand(sample_rate).astype(np.float32)
        y = (y * 32767).astype(np.int16)
        high_pass = np.diff(y, prepend=y[0])

        buffer = BytesIO()
        with wave.open(buffer, 'wb') as wf:
            wf.setnchannels(1)
            wf.setsampwidth(2)
            wf.setframerate(sample_rate)
            wf.writeframes(high_pass.tobytes())

        isolated_audio_base64 = base64.b64encode(buffer.getvalue()).decode('utf-8')

        return jsonify({
            'status': 'success',
            'isolated_audio': f"data:audio/wav;base64,{isolated_audio_base64}"
        })

    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True, port=5000, host='0.0.0.0')