import speech_recognition as sr

r = sr.Recognizer()

print("Say a short sentence now...")
with sr.Microphone() as source:
    r.adjust_for_ambient_noise(source, duration=1)
    audio = r.listen(source, timeout=5, phrase_time_limit=8)

try:
    print("Sending to Google...")
    text = r.recognize_google(audio)
    print("You said:", text)
except sr.UnknownValueError:
    print("Google couldn't understand")
except sr.RequestError as e:
    print(f"Google API error: {e}")
except Exception as e:
    print(f"Error: {e}")