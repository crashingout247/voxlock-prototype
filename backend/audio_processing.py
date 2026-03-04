import librosa
import numpy as np
import torch
import pyaudio
import time
import speech_recognition as sr
import io
import wave
import threading
import queue
from scipy.signal import butter, lfilter

# --- 1. SETUP MODELS ---
vad_model, utils = torch.hub.load(repo_or_dir='snakers4/silero-vad', model='silero_vad', trust_repo=True)
denoiser = torch.hub.load('facebookresearch/denoiser', 'dns64', trust_repo=True)
denoiser.eval()
r = sr.Recognizer()

# --- 2. CONFIG & QUEUES ---
MIC_RATE, MODEL_RATE = 48000, 16000
CHUNK_48K = 1536
SILENCE_LIMIT = 3 
# This queue holds audio chunks so the AI can process them in the background
processing_queue = queue.Queue()

def sharpen_audio(data, cutoff=300, fs=16000):
    nyq = 0.5 * fs
    b, a = butter(5, cutoff / nyq, btype='high', analog=False)
    return lfilter(b, a, data).astype(np.float32)

# --- 3. THE BACKGROUND AI WORKER ---
def ai_worker():
    while True:
        # Wait for a full sentence from the listener
        full_audio = processing_queue.get()
        if full_audio is None: break
        
        # A. Denoise
        input_t = torch.from_numpy(full_audio).unsqueeze(0)
        with torch.inference_mode():
            output_np = denoiser(input_t).squeeze(0).numpy()
        output_np = sharpen_audio(output_np)

        # B. Transcribe (Cloud)
        byte_io = io.BytesIO()
        with wave.open(byte_io, 'wb') as wav_file:
            wav_file.setnchannels(1); wav_file.setsampwidth(2); wav_file.setframerate(MODEL_RATE)
            int_data = (output_np * 32767).clip(-32768, 32767).astype(np.int16)
            wav_file.writeframes(int_data.tobytes())
        byte_io.seek(0)
        
        with sr.AudioFile(byte_io) as source:
            try:
                text = r.recognize_google(r.record(source))
                if text: print(f"\r[STT]: {text}")
            except: pass

        # C. Playback
        peak = np.max(np.abs(output_np))
        if peak > 0.05:
            output_np = (output_np / (peak + 1e-7)) * 0.8
            stream_out.write(output_np.tobytes())
        
        processing_queue.task_done()

# Start the background thinker
threading.Thread(target=ai_worker, daemon=True).start()

# --- 4. THE MAIN LISTENER LOOP ---
p = pyaudio.PyAudio()
stream_in = p.open(format=pyaudio.paFloat32, channels=1, rate=MIC_RATE, input=True)
stream_out = p.open(format=pyaudio.paFloat32, channels=1, rate=MODEL_RATE, output=True)

sentence_buffer = []
is_recording = False
silence_counter = 0

print("\n>>> Listening! Press Ctrl+C to stop. <<<\n")

try:
    while True:
        # This part NEVER stops running
        data = stream_in.read(CHUNK_48K, exception_on_overflow=False)
        audio_16k = np.frombuffer(data, dtype=np.float32)[::3].copy()
        
        # VAD Check
        with torch.inference_mode():
            speech_prob = vad_model(torch.from_numpy(audio_16k), MODEL_RATE).item()
        
        if speech_prob > 0.4:
            is_recording = True
            sentence_buffer.append(audio_16k)
            silence_counter = 0
        elif is_recording:
            sentence_buffer.append(audio_16k)
            silence_counter += 1
            
            if silence_counter > SILENCE_LIMIT:
                # SEND TO BACKGROUND WORKER
                full_sentence = np.concatenate(sentence_buffer)
                processing_queue.put(full_sentence)
                
                # RESET IMMEDIATELY (Mic stays open)
                sentence_buffer = []
                is_recording = False
                silence_counter = 0

except KeyboardInterrupt:
    print("\nStopping...")
finally:
    p.terminate()