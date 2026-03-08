import numpy as np
import torch
import pyaudio
import speech_recognition as sr
import io
import wave
import threading
import queue

# CONFIG
MIC_RATE = 48000
MODEL_RATE = 16000
CHUNK_48K = 1536
SILENCE_LIMIT = 5  # Increased so sentences are longer → better STT
VAD_THRESHOLD = 0.25

# Load VAD (no denoiser for now - simplifies testing)
print("Loading Silero VAD...")
vad_model, _ = torch.hub.load('snakers4/silero-vad', 'silero_vad', force_reload=False, trust_repo=True)

r = sr.Recognizer()

# State
processing_queue = queue.Queue()
sentence_buffer = []
is_recording = False
silence_counter = 0

def ai_worker():
    while True:
        full_audio = processing_queue.get()
        if full_audio is None:
            print("[Worker] Stopped.")
            break

        print(f"[Worker] Received {len(full_audio)} samples (raw audio)")

        # Use RAW audio (no denoise/sharpen) to test if Google likes it
        raw_audio = full_audio

        # Create WAV
        byte_io = io.BytesIO()
        with wave.open(byte_io, 'wb') as wav_file:
            wav_file.setnchannels(1)
            wav_file.setsampwidth(2)
            wav_file.setframerate(MODEL_RATE)
            int_data = (raw_audio * 32767).clip(-32768, 32767).astype(np.int16)
            wav_file.writeframes(int_data.tobytes())

        byte_io.seek(0)
        print("[Worker] WAV created (raw)")

        # STT
        with sr.AudioFile(byte_io) as source:
            try:
                print("[STT] Reading raw buffer...")
                audio_data = r.record(source)
                print(f"[STT] Buffer read OK, frame length: {len(audio_data.frame_data)} bytes")
                print("[STT] Calling Google...")
                text = r.recognize_google(audio_data)
                print(f"[STT] Success: {text}")
                from app import broadcast_transcription
                broadcast_transcription(text)
            except sr.UnknownValueError:
                print("[STT] UnknownValueError - Google didn't recognize (too quiet/short/no speech?)")
            except sr.RequestError as e:
                print(f"[STT] RequestError: {e}")
            except Exception as e:
                print(f"[STT] Error: {type(e).__name__} - {str(e)}")
            finally:
                print("[STT] Attempt finished")

        processing_queue.task_done()

# Start worker once
threading.Thread(target=ai_worker, daemon=True).start()

# Listener function (called from app.py)
def start_listening():
    print("Background listener starting...")
    p = pyaudio.PyAudio()

    print("\nMics:")
    for i in range(p.get_device_count()):
        dev = p.get_device_info_by_index(i)
        if dev['maxInputChannels'] > 0:
            print(f"  [{i}] {dev['name']}")

    DEVICE_INDEX = 0  # CHANGE IF NEEDED!

    print(f"\nUsing [{DEVICE_INDEX}] {p.get_device_info_by_index(DEVICE_INDEX)['name']}\n")

    stream_in = p.open(
        format=pyaudio.paFloat32,
        channels=1,
        rate=MIC_RATE,
        input=True,
        frames_per_buffer=CHUNK_48K,
        input_device_index=DEVICE_INDEX
    )

    print(">>> Listening active! Speak now. <<<")

    global is_recording, silence_counter, sentence_buffer

    try:
        while True:
            data = stream_in.read(CHUNK_48K, exception_on_overflow=False)

            audio_16k = np.frombuffer(data, dtype=np.float32)[::3].copy()

            max_amp = np.max(np.abs(audio_16k))
            print(f"Chunk | amp: {max_amp:.6f}")

            with torch.inference_mode():
                speech_prob = vad_model(torch.from_numpy(audio_16k), MODEL_RATE).item()

            print(f"Speech prob: {speech_prob:.4f}")

            if speech_prob > VAD_THRESHOLD:
                is_recording = True
                sentence_buffer.append(audio_16k)
                silence_counter = 0
                print("→ Detected! Recording...")
            elif is_recording:
                sentence_buffer.append(audio_16k)
                silence_counter += 1
                print(f"Silence: {silence_counter}/{SILENCE_LIMIT}")

                if silence_counter > SILENCE_LIMIT:
                    print("→ Complete → sending")
                    if sentence_buffer:
                        full_sentence = np.concatenate(sentence_buffer)
                        processing_queue.put(full_sentence)
                    sentence_buffer = []
                    is_recording = False
                    silence_counter = 0

    except KeyboardInterrupt:
        print("Listener stopped")
    finally:
        print("Cleaning listener...")
        stream_in.stop_stream()
        stream_in.close()
        p.terminate()
        print("Listener cleaned")