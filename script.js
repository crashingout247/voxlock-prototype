// Elements
const videoElement = document.getElementById('video');
const canvasElement = document.getElementById('canvas');
const canvasCtx = canvasElement.getContext('2d');
const statusDiv = document.getElementById('status');
const startBtn = document.getElementById('startBtn');

// MediaPipe Face Mesh Setup
const faceMesh = new FaceMesh({
    locateFile: (file) => {
        return `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`;
    }
});
faceMesh.setOptions({
    maxNumFaces: 2,  // Up to 2 speakers
    refineLandmarks: true,  // Accurate mouth tracking
    minDetectionConfidence: 0.5,
    minTrackingConfidence: 0.5
});
faceMesh.onResults(onResults);

// Camera Setup
const camera = new Camera(videoElement, {
    onFrame: async () => {
        await faceMesh.send({ image: videoElement });
    },
    width: 640,
    height: 480
});

// Audio Setup (Capture + Basic Processing)
let audioContext, analyser, source, prevScores = {};
async function initAudio() {
    try {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const stream = await navigator.mediaDevices.getUserMedia({ 
            audio: { echoCancellation: true, noiseSuppression: true },
            video: true 
        });
        source = audioContext.createMediaStreamSource(stream);
        analyser = audioContext.createAnalyser();
        analyser.fftSize = 256;
        source.connect(analyser);

        // Stream to earbuds (or speakers)
        const destination = audioContext.createMediaStreamDestination();
        source.connect(destination);
        const audioEl = document.getElementById('audioOutput');
        audioEl.srcObject = destination.stream;
        statusDiv.textContent += ' | Audio ready';
    } catch (err) {
        statusDiv.textContent = 'Mic/Camera error: ' + err.message;
    }
}

// Auto-Detection Results Handler
function onResults(results) {
    canvasCtx.save();
    canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
    canvasCtx.drawImage(results.image, 0, 0, canvasElement.width, canvasElement.height);

    if (results.multiFaceLandmarks) {
        results.multiFaceLandmarks.forEach((landmarks, faceIndex) => {
            // Draw face mesh (lips highlighted)
            drawConnectors(canvasCtx, landmarks, FACEMESH_LIPS, { color: '#00ff00', lineWidth: 2 });
            drawLandmarks(canvasCtx, landmarks, { color: '#ff0000', radius: 1 });

            // Mouth landmarks (indices for upper/lower lip)
            const mouthIndices = [13, 14, 15, 16, 17, 18, 19, 20];  // Simplified mouth points
            const mouthLandmarks = mouthIndices.map(idx => landmarks[idx]);
            const avgMouthY = mouthLandmarks.reduce((sum, lm) => sum + lm.y, 0) / mouthLandmarks.length;

            // Lip velocity (movement detection)
            const prevY = prevScores[faceIndex]?.mouthY || avgMouthY;
            const lipVelocity = Math.abs(avgMouthY - prevY) * 60;  // Normalized to ~60fps

            // Audio volume from mic
            const freqData = new Uint8Array(analyser.frequencyBinCount);
            analyser.getByteFrequencyData(freqData);
            const volume = freqData.reduce((a, b) => a + b, 0) / freqData.length / 255;  // 0-1 normalized

            // Activity score (70% lip, 30% volume)
            const activityScore = (lipVelocity * 0.7) + (volume * 0.3);
            prevScores[faceIndex] = { mouthY: avgMouthY, score: activityScore };

            // Auto-select highest active speaker
            if (activityScore > 0.3) {  // Threshold for "speaking"
                let maxScore = 0;
                let activeId = null;
                Object.keys(prevScores).forEach(idx => {
                    if (prevScores[idx].score > maxScore) {
                        maxScore = prevScores[idx].score;
                        activeId = idx;
                    }
                });
                if (activeId !== null && activeId != activeSpeakerId) {
                    activeSpeakerId = activeId;
                    statusDiv.textContent = `Auto-selected Speaker ${parseInt(activeId) + 1} (Score: ${maxScore.toFixed(2)})`;
                    applyVoiceFilter(activeId);  // Isolate
                }
            }

            // Draw score on face
            canvasCtx.fillStyle = activityScore > 0.3 ? '#00ff00' : '#ff0000';
            canvasCtx.fillText(`Score: ${activityScore.toFixed(2)}`, landmarks[0].x * 640, landmarks[0].y * 480 - 10);
        });
    }
    canvasCtx.restore();
}

// Simple Voice Isolation Filter (Prototype: Freq-based simulation)
let activeSpeakerId = null;
function applyVoiceFilter(speakerId) {
    if (!audioContext) return;
    // Disconnect previous
    if (filterNode) filterNode.disconnect();

    // Create filter per speaker (e.g., shift freq for "isolation")
    filterNode = audioContext.createBiquadFilter();
    filterNode.type = 'peaking';
    filterNode.frequency.value = 200 + (parseInt(speakerId) * 200);  // Mock isolation
    filterNode.gain.value = 10;  // Boost
    source.connect(filterNode).connect(audioContext.destination);
}

// Global filter var
let filterNode;

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