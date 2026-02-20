// Elements
const videoElement = document.getElementById('video');
const canvasElement = document.getElementById('canvas');
const canvasCtx = canvasElement.getContext('2d');
const statusDiv = document.getElementById('status');
const startBtn = document.getElementById('startBtn');

// MediaPipe Constants (Define FACEMESH_LIPS)
const FACEMESH_LIPS = [
  [61, 146, 91, 181, 84, 17, 314, 405, 321, 375, 291, 308, 324, 318, 402, 317, 14, 87, 178, 88, 95, 78, 191, 80, 81, 82, 13, 312, 311, 310, 415, 308],
  [78, 95, 88, 178, 87, 14, 317, 402, 318, 324, 308]
];  // From MediaPipe docs

// MediaPipe Face Mesh Setup
const faceMesh = new FaceMesh({
    locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`
});
faceMesh.setOptions({
    maxNumFaces: 2,  // Up to 2 speakers
    refineLandmarks: true,  // Accurate mouth tracking
    minDetectionConfidence: 0.5,
    minTrackingConfidence: 0.5
});
faceMesh.onResults(onResults);

// Camera Setup (Use BACK cam for environment)
const camera = new Camera(videoElement, {
    onFrame: async () => {
        await faceMesh.send({ image: videoElement });
    },
    width: 640,
    height: 480
});

// Audio Setup (Capture + Basic Processing)
let audioContext, analyser, source, prevScores = {}, activeSpeakerId = null, filterNode, audioRecorder, audioChunks = [];
async function initAudio() {
    try {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const stream = await navigator.mediaDevices.getUserMedia({ 
            audio: { echoCancellation: true, noiseSuppression: true },
            video: { facingMode: 'environment' }  // Back cam
        });
        source = audioContext.createMediaStreamSource(stream);
        analyser = audioContext.createAnalyser();
        analyser.fftSize = 256;
        source.connect(analyser);

        // Stream to earbuds
        const destination = audioContext.createMediaStreamDestination();
        source.connect(destination);
        document.getElementById('audioOutput').srcObject = destination.stream;

        // Audio Recorder for chunks
        audioRecorder = new MediaRecorder(stream);
        audioRecorder.ondataavailable = (e) => audioChunks.push(e.data);
        audioRecorder.start(500);  // 500ms chunks
        statusDiv.textContent += ' | Audio ready (Back Cam Active)';
    } catch (err) {
        statusDiv.textContent = 'Error: ' + err.message;
    }
}

// Auto-Detection Results Handler (Improved: Center bias + better scoring)
function onResults(results) {
    canvasCtx.save();
    canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
    canvasCtx.drawImage(results.image, 0, 0, canvasElement.width, canvasElement.height);

    if (results.multiFaceLandmarks) {
        let maxActivity = 0;
        let selectedId = null;
        results.multiFaceLandmarks.forEach((landmarks, faceIndex) => {
            // Draw mesh (lips green)
            drawConnectors(canvasCtx, landmarks, FACEMESH_LIPS, { color: '#00ff00', lineWidth: 2 });
            drawLandmarks(canvasCtx, landmarks, { color: '#ff0000', radius: 1 });

            // Mouth landmarks (simplified)
            const mouthIndices = [13, 14, 15, 16, 17, 18, 19, 20];
            const mouthLandmarks = mouthIndices.map(idx => landmarks[idx]);
            const avgMouthY = mouthLandmarks.reduce((sum, lm) => sum + lm.y, 0) / mouthLandmarks.length;

            // Lip velocity
            const prevY = prevScores[faceIndex]?.mouthY || avgMouthY;
            const lipVelocity = Math.abs(avgMouthY - prevY) * 60;

            // Audio volume
            const freqData = new Uint8Array(analyser.frequencyBinCount);
            analyser.getByteFrequencyData(freqData);
            const volume = freqData.reduce((a, b) => a + b, 0) / freqData.length / 255;

            // Center priority (face closer to center = higher score boost)
            const centerX = landmarks[0].x;  // Nose tip x (0-1)
            const centerBias = 1 - Math.abs(centerX - 0.5) * 2;  // 1 = center, 0 = edge

            // Activity score (60% lip, 20% volume, 20% center)
            const activityScore = (lipVelocity * 0.6) + (volume * 0.2) + (centerBias * 0.2);
            prevScores[faceIndex] = { mouthY: avgMouthY, score: activityScore };

            // Pick highest
            if (activityScore > maxActivity) {
                maxActivity = activityScore;
                selectedId = faceIndex;
            }

            // Draw score
            canvasCtx.fillStyle = activityScore > 0.3 ? '#00ff00' : '#ff0000';
            canvasCtx.fillText(`Score: ${activityScore.toFixed(2)}`, landmarks[0].x * 640, landmarks[0].y * 480 - 10);
        });

        if (selectedId !== null && selectedId !== activeSpeakerId && maxActivity > 0.3) {
            activeSpeakerId = selectedId;
            statusDiv.textContent = `Auto-selected Speaker ${selectedId + 1} (Score: ${maxActivity.toFixed(2)})`;
            applyVoiceFilter(selectedId);  // Isolate
            sendToBackend(results.image);  // Send to Flask for real isolation
        }
    }
    canvasCtx.restore();
}

// Voice Isolation Filter (Basic JS + Backend Hook)
function applyVoiceFilter(speakerId) {
    if (!audioContext) return;
    if (filterNode) filterNode.disconnect();

    filterNode = audioContext.createBiquadFilter();
    filterNode.type = 'peaking';
    filterNode.frequency.value = 200 + (parseInt(speakerId) * 200);  // Mock per speaker
    filterNode.gain.value = 10;  // Boost selected
    source.connect(filterNode).connect(audioContext.destination);
}

// Send to Backend (For Real Isolation)
async function sendToBackend(image) {
    try {
        const canvasTemp = document.createElement('canvas');
        canvasTemp.width = 640;
        canvasTemp.height = 480;
        canvasTemp.getContext('2d').drawImage(image, 0, 0);
        const frameData = canvasTemp.toDataURL('image/jpeg');

        const response = await fetch('http://localhost:5000/process', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ frame: frameData })
        });
        const data = await response.json();
        // Play clean audio
        if (data.isolated_audio) {
            const audioBlob = new Blob([atob(data.isolated_audio)], { type: 'audio/wav' });
            const audioUrl = URL.createObjectURL(audioBlob);
            document.getElementById('audioOutput').src = audioUrl;
        }
    } catch (err) {
        console.error('Backend error: ' + err);
    }
}

// Start Button Event
startBtn.addEventListener('click', async () => {
    if (!audioContext) await initAudio();
    if (camera.isRunning) {
        camera.stop();
        startBtn.textContent = 'Start VoxLock';
        statusDiv.textContent = 'Stopped';
    } else {
        camera.start();
        startBtn.textContent = 'Stop VoxLock';
        statusDiv.textContent = 'Running - Auto Mode: Detecting lips + voice...';
    }
});