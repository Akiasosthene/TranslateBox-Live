# First test with the real OpenAI service

Run this once before showing Syntova to a client. Use headphones on the listening phone so the
room microphone does not pick up the translation.

## 1. Simple mode (default): microphone to the server

1. Sign in on https://syntova.cloud/login, open **Present**. In Advanced settings, "Where translation runs" should say **Server (recommended)**.
2. Create a session: main language English, extra languages French and Spanish.
3. Scan the QR code with a phone, pick French, tap **LISTEN**.
4. Speak for two minutes. Expect French audio about 1 to 2 seconds behind, and captions.
5. Switch the phone to Spanish while you speak: audio should follow within a few seconds.
6. Put the laptop to sleep for a minute, then wake it: the console must show "Reconnecting…" then LIVE again, and phones must get audio again without touching anything.

## 2. Text-and-voice language (cascade)

1. New session with English plus **Swahili** (or Arabic, Turkish…), one of the 42 extra languages.
2. Listen in Swahili. Expect each sentence a few seconds after you finish it, read by a studio voice.
3. If nothing comes: `docker compose logs --tail=80 backend | grep -i cascade`.

## 3. Server mode (stream, console closed)

1. In the console audio card, choose **Meeting or stream (RTMP / SRT)** and copy the server URL and stream key.
2. From any computer with ffmpeg and a speech recording:
   ```bash
   ffmpeg -re -i speech.mp3 -c:a aac -b:a 128k -vn -f flv "rtmp://syntova.cloud:1935/live/STREAM_KEY"
   ```
   or set the same address in OBS (Settings, Stream, Custom).
3. Under **Run on the server**, click **Start on the server**, then close the console tab.
4. Listen on the phone: translation must keep going.
5. Stop the stream and wait: the server stops on its own after 30 minutes of silence.

## 4. After the test

- Portal → Activity shows the minutes used per language.
- If you turned on archiving: Portal → Transcripts, download the SRT.
- Ask for an AI summary and check it on the listener page.

Note anything that fails (step number, what you saw, the time) and send it with
`docker compose logs --since 30m backend > backend.log`.
