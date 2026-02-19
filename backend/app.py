from flask import Flask, request, jsonify
from flask_cors import CORS
import base64
from io import BytesIO
import numpy as np
import cv2
import wave

app = Flask(__name__)
CORS(app)

@app.route('/process', methods=['POST'])
def process():
    data = request.json['frame']
    img_data = base64.b64decode(data.split(',')[1])
    nparr = np.frombuffer(img_data, np.uint8)
    frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

    gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)

    y = np.random.rand(16000).astype(np.int16)  # Mock audio
    high_pass = np.diff(y, prepend=0)  # Noise reduction
    buffer = BytesIO()
    with wave.open(buffer, 'wb') as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(16000)
        wf.writeframes(high_pass.tobytes())
    isolated_audio = base64.b64encode(buffer.getvalue()).decode()

    return jsonify({'isolated_audio': isolated_audio})

if __name__ == '__main__':
    app.run(debug=True, port=5000)