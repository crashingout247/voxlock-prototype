# Remove this line completely:
# from app import broadcast_transcription

# Change the emit line inside try block to:
socketio.emit('transcription', {'text': text}, broadcast=True, namespace='/')
import numpy as np
import torch
import pyaudio
import speech_recognition as sr
import io
import wave
import threading
import queue
import base64

# CONFIG
MIC_RATE = 48000
MODEL_RATE = 16000
CHUNK_48K = 1536
SILENCE_LIMIT = 5
VAD_THRESHOLD = 0.25

print("Loading Silero VAD...")
vad_model, _ = torch.hub.load('snakers4/silero-vad', 'silero_vad', force_reload=False, trust_repo=True)

r = sr.Recognizer()

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

        print(f"[Worker] Received {len(full_audio)} samples")

        # Raw audio for STT (no denoise for simplicity)
        raw_audio = full_audio

        # Create WAV for STT
        byte_io = io.BytesIO()
        with wave.open(byte_io, 'wb') as wav_file:
            wav_file.setnchannels(1)
            wav_file.setsampwidth(2)
            wav_file.setframerate(MODEL_RATE)
            int_data = (raw_audio * 32767).clip(-32768, 32767).astype(np.int16)
            wav_file.writeframes(int_data.tobytes())

        byte_io.seek(0)
        print("[Worker] WAV ready")

               # STT
        with sr.AudioFile(byte_io) as source:
            try:
                print("[STT] Reading buffer...")
                audio_data = r.record(source)
                print("[STT] Buffer read OK, frame length:", len(audio_data.frame_data))
                print("[STT] Calling Google...")
                text = r.recognize_google(audio_data)
                print(f"[STT] Success: '{text}'")
                from app import broadcast_transcription
                broadcast_transcription(text)
            except sr.UnknownValueError as e:
                print("[STT] Google could not understand audio (UnknownValueError)")
                print("Details:", str(e))
            except sr.RequestError as e:
                print("[STT] Google request failed (RequestError):", str(e))
            except sr.WaitTimeoutError as e:
                print("[STT] Timeout waiting for audio (WaitTimeoutError):", str(e))
            except Exception as e:
                print("[STT] Unexpected error during STT:")
                print(type(e).__name__, ":", str(e))
                import traceback
                traceback.print_exc()
            finally:
                print("[STT] Attempt finished")

        processing_queue.task_done()

threading.Thread(target=ai_worker, daemon=True).start()

def start_listening(socketio_instance):
    global socketio
    socketio = socketio_instance
    print("Starting listener...")
    p = pyaudio.PyAudio()

    print("\nAvailable mics:")
    for i in range(p.get_device_count()):
        dev = p.get_device_info_by_index(i)
        if dev['maxInputChannels'] > 0:
            print(f"  [{i}] {dev['name']}")

    DEVICE_INDEX = 0  # CHANGE IF NEEDED

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

    GAIN = 5.0  # Adjust if needed

    try:
        while True:
            data = stream_in.read(CHUNK_48K, exception_on_overflow=False)
            socketio.emit('transcription', {'text': text}, broadcast=True, namespace='/')

            audio_16k = np.frombuffer(data, dtype=np.float32)[::3].copy()

            audio_16k *= GAIN
            audio_16k = np.clip(audio_16k, -1.0, 1.0)

            max_amp = np.max(np.abs(audio_16k))
            print(f"Chunk | amp: {max_amp:.6f}")

            with torch.inference_mode():
                speech_prob = vad_model(torch.from_numpy(audio_16k), MODEL_RATE).item()

            print(f"Speech prob: {speech_prob:.4f}")

            if speech_prob > VAD_THRESHOLD:
                is_recording = True
                sentence_buffer.append(audio_16k / GAIN)
                silence_counter = 0
                print("→ Detected! Recording...")
            elif is_recording:
                sentence_buffer.append(audio_16k / GAIN)
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