import librosa
import numpy as np
import torch
import speech_recognition as sr
import io
import wave
from scipy.signal import butter, lfilter

print("Loading Models (VAD & Denoiser)...")

# Load models
vad_model, utils = torch.hub.load(
    repo_or_dir='snakers4/silero-vad',
    model='silero_vad',
    force_reload=False,
    trust_repo=True
)
denoiser = torch.hub.load(
    'facebookresearch/denoiser',
    'dns64',
    force_reload=False,
    trust_repo=True
)
denoiser.eval()

r = sr.Recognizer()

MODEL_RATE = 16000
VAD_THRESHOLD = 0.25

def sharpen_audio(data, cutoff=300, fs=MODEL_RATE):
    nyq = 0.5 * fs
    b, a = butter(5, cutoff / nyq, btype='high', analog=False)
    sharpened = lfilter(b, a, data).astype(np.float32)
    return sharpened

def process_audio_data(audio_bytes):
    try:
        audio_16k = np.frombuffer(audio_bytes, dtype=np.float32)
        
        # VAD detection
        with torch.inference_mode():
            vad_input = torch.from_numpy(audio_16k)
            speech_prob = vad_model(vad_input, MODEL_RATE).item()
        
        if speech_prob < VAD_THRESHOLD:
            return None, None

        # Denoising
        input_t = torch.from_numpy(audio_16k).unsqueeze(0)
        with torch.inference_mode():
            denoised_t = denoiser(input_t)
        output_np = denoised_t.squeeze(0).numpy()

        # Sharpen audio
        sharpened = sharpen_audio(output_np)

        # Speech-to-Text
        text = ""
        byte_io = io.BytesIO()
        with wave.open(byte_io, 'wb') as wav_file:
            wav_file.setnchannels(1)
            wav_file.setsampwidth(2)
            wav_file.setframerate(MODEL_RATE)
            int_data = (sharpened * 32767).clip(-32768, 32767).astype(np.int16)
            wav_file.writeframes(int_data.tobytes())

        byte_io.seek(0)
        with sr.AudioFile(byte_io) as source:
            try:
                audio_data = r.record(source)
                text = r.recognize_google(audio_data)
            except Exception as e:
                print(f"[STT Error] {e}")

        # Normalize volume
        peak = np.max(np.abs(output_np))
        if peak > 0.05:
            output_np = (output_np / (peak + 1e-7)) * 0.8
            
        return output_np.tobytes(), text

    except Exception as e:
        print(f"Error processing audio: {e}")
        return None, None