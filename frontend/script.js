const videoElement = document.getElementById('video');
const canvasElement = document.getElementById('canvas');
const canvasCtx = canvasElement.getContext('2d');
const statusDiv = document.getElementById('status');
const startBtn = document.getElementById('startBtn');
const transcriptionDiv = document.getElementById('transcription');

let gestureType = "none";
let isSystemRunning = false;
let audioContext, mediaStream, audioProcessor;

// Target Locking Variables
let lockedFaceIndex = -1; 
let faceBoundingBoxes = []; 

// Data Storage & Flicker Control
let latestFaceResults = null;
let latestHandResults = null;
let drawTrigger = "none"; 

// ==================== Socket.IO Setup ====================
const socket = io('http://127.0.0.1:8080');

socket.on('connect', () => { console.log('Connected to AI Backend!'); });

socket.on('transcription', (data) => {
    if(data.text) transcriptionDiv.innerText = `Subtitles: "${data.text}"`;
});

socket.on('audio_playback', (arrayBuffer) => {
    if (!audioContext || !isSystemRunning) return;
    const float32Array = new Float32Array(arrayBuffer);
    const audioBuffer = audioContext.createBuffer(1, float32Array.length, 16000);
    audioBuffer.getChannelData(0).set(float32Array);
    const source = audioContext.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(audioContext.destination);
    source.start();
});

// ==================== MediaPipe AI Setup ====================
const faceMesh = new FaceMesh({
    locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`,
});
faceMesh.setOptions({ maxNumFaces: 5, refineLandmarks: true, minDetectionConfidence: 0.5, minTrackingConfidence: 0.5 });

const hands = new Hands({
    locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`,
});
hands.setOptions({ maxNumHands: 1, modelComplexity: 1, minDetectionConfidence: 0.5, minTrackingConfidence: 0.5 });

faceMesh.onResults((results) => { 
    latestFaceResults = results; 
    drawTrigger = "face"; 
    
    if (isSystemRunning && results.multiFaceLandmarks.length > 0) {
        results.multiFaceLandmarks.forEach((face, index) => {
            const isTarget = (lockedFaceIndex === index);
            const isUnlockedMode = (lockedFaceIndex === -1);
            
            if (isTarget || (isUnlockedMode && index === 0)) {
                const lipIndices = [61, 146, 91, 181, 84, 17, 314, 405, 321, 375, 291, 308, 324, 318, 402, 317, 14, 87, 178, 88, 95];
                const lipData = lipIndices.map(i => ({ x: face[i].x, y: face[i].y, z: face[i].z }));
                socket.emit('lip_data', lipData);
            }
        });
    }
});

hands.onResults((results) => { 
    latestHandResults = results; 
    drawTrigger = "hands"; 
});

const camera = new Camera(videoElement, {
    onFrame: async () => {
        if (isSystemRunning) {
            await faceMesh.send({ image: videoElement });
            await hands.send({ image: videoElement });
        }
    },
    width: 640,
    height: 480,
});

// ==================== Smooth Graphics Loop ====================
function renderSmoothGraphics() {
    canvasCtx.save();
    canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
    
    if (isSystemRunning) {
        canvasCtx.drawImage(videoElement, 0, 0, canvasElement.width, canvasElement.height);
    }

    faceBoundingBoxes = [];
    if (latestFaceResults && latestFaceResults.multiFaceLandmarks && isSystemRunning) {
        latestFaceResults.multiFaceLandmarks.forEach((face) => {
            const xs = face.map(p => p.x);
            const ys = face.map(p => p.y);
            faceBoundingBoxes.push({ minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) });
        });
    }

    // --- NEW ROCK-SOLID GESTURE MATH ---
    gestureType = "none";
    if (latestHandResults && latestHandResults.multiHandLandmarks && latestHandResults.multiHandLandmarks.length > 0 && isSystemRunning) {
        const hand = latestHandResults.multiHandLandmarks[0];
        
        // Helper function to measure physical distance between two joints
        const getDist = (p1, p2) => Math.sqrt(Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2));
        
        // Measure wrist (0) to middle knuckle (9) AND wrist (0) to middle tip (12)
        const middleKnuckleDist = getDist(hand[9], hand[0]); 
        const middleTipDist = getDist(hand[12], hand[0]); 
        
        // Create a ratio of the distances
        const curlRatio = middleTipDist / middleKnuckleDist;
        
        // Fist: tip is curled inward, distance is roughly equal to or less than knuckle distance
        const isFist = curlRatio < 1.25; 
        
        // Palm: fingers extended, tip is almost twice as far as the knuckle
        const isFlat = curlRatio > 1.6;
        // Palm down: middle fingertip is physically lower on the screen than the wrist
        const isPointingDown = hand[12].y > hand[0].y; 
        
        const isPalmDown = isFlat && isPointingDown;
        
        if (isFist) {
            gestureType = "fist";
            statusDiv.textContent = 'Status: FIST DETECTED - Microphones Muted';
        } else if (isPalmDown) {
            gestureType = "palm_down";
            statusDiv.textContent = 'Status: FLAT PALM - Enhanced AI Processing';
        } else if (lockedFaceIndex !== -1) {
            statusDiv.textContent = `Status: Locked on Target ${lockedFaceIndex + 1}`;
        } else {
            statusDiv.textContent = 'Status: Unlocked (Standard Listening)';
        }
    }

    if (drawTrigger === "face" && latestFaceResults && latestFaceResults.multiFaceLandmarks && isSystemRunning) {
        latestFaceResults.multiFaceLandmarks.forEach((face, index) => {
            const isTarget = (lockedFaceIndex === index);
            const isUnlockedMode = (lockedFaceIndex === -1);
            const meshColor = (isTarget || isUnlockedMode) ? '#00e5ff' : '#ffffff20';
            const lipColor = (isTarget || isUnlockedMode) ? '#b026ff' : '#ffffff20';

            drawConnectors(canvasCtx, face, FACEMESH_TESSELATION, { color: meshColor, lineWidth: 1 });
            drawConnectors(canvasCtx, face, FACEMESH_LIPS, { color: lipColor, lineWidth: 2 });
        });
        drawTrigger = "none";
    } 
    else if (drawTrigger === "hands" && latestHandResults && latestHandResults.multiHandLandmarks && isSystemRunning) {
        const hand = latestHandResults.multiHandLandmarks[0];
        drawConnectors(canvasCtx, hand, HAND_CONNECTIONS, { color: '#00FFFF', lineWidth: 4 });
        drawLandmarks(canvasCtx, hand, { color: '#FF00FF', lineWidth: 2 });
        drawTrigger = "none"; 
    }

    canvasCtx.restore();
    requestAnimationFrame(renderSmoothGraphics);
}

renderSmoothGraphics();

// ==================== Audio & Controls ====================
async function initAudio() {
    audioContext = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 16000 });
    mediaStream = await navigator.mediaDevices.getUserMedia({ video: false, audio: { echoCancellation: true, noiseSuppression: true } });
    const source = audioContext.createMediaStreamSource(mediaStream);
    audioProcessor = audioContext.createScriptProcessor(4096, 1, 1);
    source.connect(audioProcessor);
    audioProcessor.connect(audioContext.destination);

    audioProcessor.onaudioprocess = (e) => {
        if (!isSystemRunning) return;
        const inputData = e.inputBuffer.getChannelData(0);
        socket.emit('gesture_state', gestureType); 
        socket.emit('audio_stream', inputData.buffer); 
    };
}

canvasElement.addEventListener('click', (event) => {
    const rect = canvasElement.getBoundingClientRect();
    const clickX = (event.clientX - rect.left) / canvasElement.width;
    const clickY = (event.clientY - rect.top) / canvasElement.height;
    let clickedOnSomeone = false;

    for (let i = 0; i < faceBoundingBoxes.length; i++) {
        const box = faceBoundingBoxes[i];
        if (clickX >= box.minX && clickX <= box.maxX && clickY >= box.minY && clickY <= box.maxY) {
            lockedFaceIndex = i;
            clickedOnSomeone = true;
            break;
        }
    }
    if (!clickedOnSomeone) lockedFaceIndex = -1;
});

startBtn.addEventListener('click', async () => {
    if (!audioContext) await initAudio();
    if (isSystemRunning) {
        camera.stop();
        isSystemRunning = false;
        startBtn.textContent = 'Initialize Core';
        statusDiv.textContent = 'System Offline';
    } else {
        camera.start();
        isSystemRunning = true;
        startBtn.textContent = 'Shutdown System';
        statusDiv.textContent = 'Starting Arrays...';
    }
});