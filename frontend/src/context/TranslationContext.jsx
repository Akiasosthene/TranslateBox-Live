import React, { createContext, useContext, useEffect, useRef, useState, useCallback, useMemo } from "react";
import { TranslationEngine } from "../lib/translationEngine";
import { MODES, EMPTY_PROFILE, compileInstructions } from "../lib/profiles";
import { getTarget } from "../lib/languages";
import { usePersistentState } from "../hooks/usePersistentState";
import { useBroadcast } from "../hooks/useBroadcast";
import { SegmentRecorder } from "../lib/transcript";
import { StreamInput, setStreamInput, getStreamInput, fetchIngest } from "../lib/streamInput";
import { CaptionRelay } from "../lib/captionRelay";
import { dubSegments } from "../lib/dubbing";
import { operatorFetch, responseError } from "../lib/api";
import { SpeechPipeline, STUDIO_VOICES, VOICE_STYLES, applyGlossary, parseGlossary, previewVoice as requestPreview } from "../lib/speech";

import { API } from "../lib/api";

const Ctx = createContext(null);
export const useTranslationSession = () => useContext(Ctx);

const INITIAL_STATUS = {
  mic: "idle",
  openai: "standby",
  translation: "standby",
  outputAudio: "idle",
  network: "optimal",
  reconnectCount: 0,
};

function mapError(err) {
  const msg = err?.message || String(err);
  const parts = msg.split(":");
  const code = parts[0];
  const detail = parts.slice(2).join(":");
  switch (code) {
    case "MIC_PERMISSION":
      if (parts[1] === "NotFoundError") return "No microphone was found. Connect an audio input, then choose it in Audio input.";
      if (parts[1] === "NotReadableError") return "The microphone is busy or unavailable. Close other audio applications and retry.";
      if (parts[1] === "OverconstrainedError") return "The selected microphone is no longer available. Choose another Audio input.";
      return "Microphone access was denied. Allow it in the browser and macOS privacy settings, then retry Test.";
    case "NO_AUDIO_INPUT":
      return detail || "No audio input detected. Check your microphone or USB audio interface.";
    case "SESSION_TOKEN":
      return `Could not start a translation session. ${detail || "The OpenAI API key may be missing on the server."}`;
    case "OPENAI_CONNECT": {
      const st = parts[1];
      if (st === "429") return "The translation service is temporarily unavailable (quota limit reached). Please try again later.";
      return `Could not connect to the translation service (code ${st}). Please try again.`;
    }
    default:
      return msg;
  }
}

export function TranslationProvider({ children }) {
  const [status, setStatus] = useState(INITIAL_STATUS);
  const [sourceText, setSourceText] = useState("");
  const [targetText, setTargetText] = useState("");
  const [logs, setLogs] = useState([]);
  const [rawEvents, setRawEvents] = useState([]);
  const [error, setError] = useState(null);
  const [active, setActive] = useState(false);
  const [translationMuted, setTranslationMuted] = useState(false);
  const [inputMuted, setInputMuted] = useState(false);
  const [duration, setDuration] = useState(0);
  const [translatedSeconds, setTranslatedSeconds] = useState(0);
  const [devices, setDevices] = useState([]);
  const [selectedDevice, setSelectedDevice] = useState("");
  const [outputDevices, setOutputDevices] = useState([]);
  const [selectedOutput, setSelectedOutput] = usePersistentState("tbl-output", "");
  const [ambientMode, setAmbientMode] = usePersistentState("tbl-ambient", false);
  // "mic" (local microphone) or "stream" (RTMP/SRT relayed by the server).
  const [captureSource, setCaptureSourceState] = useState("mic");
  const [streamState, setStreamState] = useState({ connected: false, live: false, error: "", level: 0 });
  const [ingestInfo, setIngestInfo] = useState(null);
  const [sourceLang, setSourceLang] = usePersistentState("tbl-source", "auto");
  const [targetLang, setTargetLang] = usePersistentState("tbl-target", "en");
  const [modeKey, setModeKey] = usePersistentState("tbl-mode", "GENERAL");
  const [customInstructions, setCustomInstructions] = usePersistentState("tbl-custom", "");
  const [profile, setProfile] = usePersistentState("tbl-profile", EMPTY_PROFILE);
  const [saveTranscripts, setSaveTranscripts] = usePersistentState("tbl-save", false);
  const [level, setLevel] = useState({ level: 0, peak: 0 });
  const [testing, setTesting] = useState(false);
  const [metrics, setMetrics] = useState({ latencyMs: null, avgLatencyMs: null, instructionsApplied: false, pcState: "", iceState: "" });
  // Voice: "original" = realtime translation voice; "studio" = fixed TTS voice.
  const [voiceMode, setVoiceMode] = usePersistentState("tbl-voice-mode", "original");
  const [studioVoice, setStudioVoice] = usePersistentState("tbl-voice", "marin");
  const [voiceStyleKey, setVoiceStyleKey] = usePersistentState("tbl-voice-style", "interpreter");
  const [customVoiceStyle, setCustomVoiceStyle] = usePersistentState("tbl-voice-style-custom", "");
  const [glossary, setGlossary] = usePersistentState("tbl-glossary", "");
  const [previewing, setPreviewing] = useState(false);
  const speechRef = useRef(null);
  const [extraLangs, setExtraLangs] = usePersistentState("tbl-extra-langs", []);
  const [humanLangs, setHumanLangs] = usePersistentState("tbl-human-langs", []);
  const [pttEnabled, setPttEnabled] = usePersistentState("tbl-ptt", false);
  const [autoStopMinutes, setAutoStopMinutes] = usePersistentState("tbl-autostop", 0);
  // Stop after this many minutes without any speech (0 = never).
  const [idleStopMinutes, setIdleStopMinutes] = usePersistentState("tbl-idlestop", 0);
  const [pttKey, setPttKey] = usePersistentState("tbl-ptt-key", "Space");
  const [archiveState, setArchiveState] = useState({ at: null, error: "" });
  const [relayDestinations, setRelayDestinations] = useState([]);
  const relayRef = useRef(null);
  if (!relayRef.current) relayRef.current = new CaptionRelay({ apiBase: API, onChange: setRelayDestinations });
  const primarySegmentRef = useRef("");
  const glossaryRulesRef = useRef(null);
  // Current speaker label (Wordly "Enter Name"): shown at speaker changes.
  const [speaker, setSpeaker] = useState("");
  const speakerRef = useRef("");
  speakerRef.current = speaker;
  const labelledRef = useRef({ target: "" });
  const lastActivityRef = useRef(Date.now());
  const targetLangRef = useRef(targetLang);
  targetLangRef.current = targetLang;
  // Timed transcripts for subtitle export and summaries (tab memory only).
  const recordersRef = useRef({ source: new SegmentRecorder(), target: new SegmentRecorder() });

  const engineRef = useRef(null);
  const audioRef = useRef(null);
  const timerRef = useRef(null);

  if (!engineRef.current) {
    engineRef.current = new TranslationEngine({
      apiBase: API,
      handlers: {
        onStatus: (patch) => setStatus((s) => ({ ...s, ...patch })),
        onTranscript: ({ side, delta, segmentBreak }) => {
          lastActivityRef.current = Date.now();
          const rec = recordersRef.current[side];
          if (rec) { if (segmentBreak) rec.end(); else rec.delta(delta, speakerRef.current || null); }
          // Label the caption when the speaker changes, at the start of a segment.
          if (side === "target" && !segmentBreak && delta && primarySegmentRef.current === "" && speakerRef.current && labelledRef.current.target !== speakerRef.current) {
            labelledRef.current.target = speakerRef.current;
            delta = `${speakerRef.current}: ${delta}`;
          }
          if (side === "target") {
            if (segmentBreak) {
              const text = primarySegmentRef.current.trim();
              primarySegmentRef.current = "";
              if (text) relayRef.current.push(targetLangRef.current, applyGlossary(text, glossaryRulesRef.current, targetLangRef.current));
            } else primarySegmentRef.current += delta || "";
          }
          if (side === "target" && speechRef.current) {
            if (segmentBreak) speechRef.current.endSegment();
            else speechRef.current.feed(delta.replace(/^[^:\n]{1,80}: /, (m) => (m.slice(0, -2) === labelledRef.current.target ? "" : m)));
          }
          const setter = side === "source" ? setSourceText : setTargetText;
          setter((prev) => {
            if (segmentBreak) {
              if (prev === "" || prev.endsWith("\n\n")) return prev;
              return prev + "\n\n";
            }
            return prev + (delta || "");
          });
        },
        onLog: (entry) => setLogs((l) => [...l.slice(-499), entry]),
        onRawEvent: (ev) => setRawEvents((r) => [...r.slice(-199), { ts: new Date().toISOString(), ev }]),
        onError: (msg) => setError(msg),
        onLevel: (lv) => setLevel(lv),
        onMetrics: (m) => setMetrics((prev) => ({ ...prev, ...m })),
      },
    });
  }

  if (!speechRef.current) {
    speechRef.current = new SpeechPipeline({
      apiBase: API,
      onAudio: (buf) => engineRef.current.program.pushSpeech(buf),
      onLog: (level, message, data) => setLogs((l) => [...l.slice(-499), { ts: new Date().toISOString(), level, message, data }]),
      onError: (msg) => setError(msg),
    });
  }

  const voiceStyle = voiceStyleKey === "custom" ? customVoiceStyle : (VOICE_STYLES[voiceStyleKey] || VOICE_STYLES.interpreter).text;
  useEffect(() => {
    engineRef.current.program.setVoiceMode(voiceMode);
    speechRef.current.configure({ enabled: voiceMode === "studio", voice: studioVoice, style: voiceStyle, glossary, lang: targetLang });
  }, [voiceMode, studioVoice, voiceStyle, glossary, targetLang]);

  const glossaryRules = useMemo(() => parseGlossary(glossary), [glossary]);
  glossaryRulesRef.current = glossaryRules;
  const captionText = useMemo(() => applyGlossary(targetText, glossaryRules, targetLang), [targetText, glossaryRules, targetLang]);
  // Preferred terms go to the interpreter (kept short: the server caps instructions).
  const boostLine = useMemo(() => {
    let list = "";
    for (const term of glossaryRules?.boost || []) {
      if (list.length + term.length > 1500) break;
      list += (list ? ", " : "") + term;
    }
    return list ? `\n\nPreferred terms and spellings: ${list}` : "";
  }, [glossaryRules]);
  const voiceMeta = useMemo(() => voiceMode === "studio"
    ? { mode: "studio", voice: STUDIO_VOICES.find((v) => v.id === studioVoice)?.label || studioVoice }
    : { mode: "original", voice: null }, [voiceMode, studioVoice]);

  const previewVoice = useCallback(async () => {
    setPreviewing(true);
    try { await requestPreview(API, { voice: studioVoice, style: voiceStyle, lang: targetLang }); }
    catch (e) { setError("Voice preview failed: " + e.message); }
    finally { setTimeout(() => setPreviewing(false), 4000); }
  }, [studioVoice, voiceStyle, targetLang]);

  const setOutputDevice = useCallback((id) => {
    setSelectedOutput(id);
    engineRef.current.setOutputDevice(id);
  }, [setSelectedOutput]);

  const loadDevices = useCallback(async () => {
    try {
      const list = await engineRef.current.listDevices();
      setDevices(list);
      setSelectedDevice((cur) => cur || (list[0]?.deviceId ?? ""));
      const outs = await engineRef.current.listOutputDevices();
      setOutputDevices(outs);
    } catch (err) {
      console.error("[TranslationContext] device enumeration failed", err);
    }
  }, []);

  useEffect(() => {
    engineRef.current.attachAudio(audioRef.current);
    if (selectedOutput) engineRef.current.setOutputDevice(selectedOutput);
    loadDevices();
    const onOnline = () => setStatus((s) => ({ ...s, network: engineRef.current.active ? "degraded" : "optimal" }));
    const onOffline = () => setStatus((s) => ({ ...s, network: "offline" }));
    const onDeviceChange = async () => {
      await loadDevices();
      // If the active input device vanished, notify the operator.
      const eng = engineRef.current;
      if (eng.active && eng.captureSource === "mic" && selectedDevice) {
        const list = await eng.listDevices();
        if (!list.find((d) => d.deviceId === selectedDevice)) {
          setError("The selected audio input device was disconnected. Choose another input device.");
          setStatus((s) => ({ ...s, mic: "error" }));
        }
      }
    };
    navigator.mediaDevices?.addEventListener?.("devicechange", onDeviceChange);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      navigator.mediaDevices?.removeEventListener?.("devicechange", onDeviceChange);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadDevices, selectedDevice]);

  const startTimer = () => {
    clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setDuration((d) => d + 1);
      setStatus((s) => {
        if (s.translation === "interpreting") setTranslatedSeconds((t) => t + 1);
        return s;
      });
    }, 1000);
  };
  const stopTimer = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
  };

  const start = useCallback(async () => {
    if (engineRef.current.active) return true;
    setError(null);
    recordersRef.current.source.reset();
    recordersRef.current.target.reset();
    setSourceText("");
    setTargetText("");
    setDuration(0);
    setTranslatedSeconds(0);
    setTesting(false);
    const targetName = getTarget(targetLang).name;
    const instructions = (compileInstructions({ modeKey, customText: customInstructions, targetName, profile }) + boostLine).slice(0, 6000);
    labelledRef.current = { target: "" };
    lastActivityRef.current = Date.now();
    try {
      await engineRef.current.start({
        deviceId: selectedDevice,
        source: captureSource,
        targetLanguage: targetLang,
        instructions,
        ambient: ambientMode,
      });
      if (!engineRef.current.active) return false;
      setActive(true);
      startTimer();
      loadDevices();
      return true;
    } catch (e) {
      setError(mapError(e));
      setActive(false);
      return false;
    }
  }, [selectedDevice, captureSource, targetLang, modeKey, customInstructions, profile, ambientMode, loadDevices, boostLine]);

  const stop = useCallback(() => {
    speechRef.current.reset();
    engineRef.current.stop();
    setActive(false);
    stopTimer();
    recordersRef.current.source.end();
    recordersRef.current.target.end();
    if (!saveTranscripts) {
      setSourceText("");
      setTargetText("");
      recordersRef.current.source.reset();
      recordersRef.current.target.reset();
    }
  }, [saveTranscripts]);

  const restart = useCallback(async () => {
    speechRef.current.reset();
    engineRef.current.stop();
    setActive(false);
    stopTimer();
    await new Promise((r) => setTimeout(r, 300));
    await start();
  }, [start]);

  const reset = useCallback(() => {
    speechRef.current.reset();
    engineRef.current.stop();
    setActive(false);
    stopTimer();
    setSourceText("");
    setTargetText("");
    setError(null);
    setDuration(0);
    setTranslatedSeconds(0);
    setRawEvents([]);
    setTranslationMuted(false);
    setInputMuted(false);
    engineRef.current.setTranslationMuted(false);
    setMetrics({ latencyMs: null, avgLatencyMs: null, instructionsApplied: false, pcState: "", iceState: "" });
  }, []);

  const toggleTranslationMute = useCallback(() => {
    setTranslationMuted((m) => {
      const next = !m;
      engineRef.current.setTranslationMuted(next);
      return next;
    });
  }, []);

  const inputMutedRef = useRef(inputMuted);
  inputMutedRef.current = inputMuted;

  const testInput = useCallback(async () => {
    setError(null);
    try {
      await engineRef.current.testInput(selectedDevice, captureSource, ambientMode);
      setTesting(true);
    } catch (e) {
      setError(mapError(e));
      setTesting(false);
    }
  }, [selectedDevice, captureSource, ambientMode]);

  const stopTest = useCallback(async () => {
    await engineRef.current.stopTest();
    setTesting(false);
  }, []);

  const channelStartArgs = useCallback((lang) => ({
    deviceId: selectedDevice,
    source: captureSource,
    ambient: ambientMode,
    instructions: (compileInstructions({ modeKey, customText: customInstructions, targetName: getTarget(lang).name, profile }) + boostLine).slice(0, 6000),
  }), [selectedDevice, captureSource, ambientMode, modeKey, customInstructions, profile, boostLine]);
  const channelVoiceConfig = useMemo(() => ({
    voiceMode, voice: studioVoice, voiceLabel: STUDIO_VOICES.find((v) => v.id === studioVoice)?.label, style: voiceStyle, glossary,
  }), [voiceMode, studioVoice, voiceStyle, glossary]);

  const broadcast = useBroadcast({
    API, engineRef, targetLang, profile, start, stop, setError, targetText: captionText, active, setTargetLang,
    voiceMeta, extraLangs, setExtraLangs, channelStartArgs, channelVoiceConfig, keepTranscripts: saveTranscripts,
    humanLangs, setHumanLangs, micMuted: inputMuted,
    onExtraSegment: (lang, text) => relayRef.current.push(lang, text),
  });

  // Push-to-talk and the mic button gate every channel that uses the microphone.
  const setMicMuted = useCallback((muted) => {
    engineRef.current.setInputMuted(muted);
    broadcast.setChannelsMicMuted(muted);
    setInputMuted(muted);
  }, [broadcast]);
  useEffect(() => { if (pttEnabled) setMicMuted(true); }, [pttEnabled, active]); // eslint-disable-line react-hooks/exhaustive-deps

  // Automatic stop after a set duration protects the OpenAI budget.
  useEffect(() => {
    if (!autoStopMinutes || !broadcast.broadcasting || duration < autoStopMinutes * 60) return;
    broadcast.stopEvent();
    setError(`Automatic stop after ${autoStopMinutes} minutes (Settings → automatic stop).`);
  }, [duration, autoStopMinutes, broadcast]);

  // Idle stop: nobody has spoken for a while (Wordly "auto-pause on silence").
  useEffect(() => {
    if (!idleStopMinutes || !active) return;
    if (Date.now() - lastActivityRef.current < idleStopMinutes * 60000) return;
    if (broadcast.broadcasting) broadcast.stopEvent(); else stop();
    setError(`Stopped after ${idleStopMinutes} minutes without speech (Settings → stop on silence).`);
  }, [duration, idleStopMinutes, active, broadcast, stop]);

  // Speaker label reaches every extra language too.
  useEffect(() => {
    for (const ch of broadcast.extrasRef.current.values()) ch.setSpeaker(speaker);
  }, [speaker, broadcast.channels, broadcast.extrasRef]);

  const fetchUsage = useCallback(async () => {
    const res = await operatorFetch(`${API}/usage`);
    if (!res.ok) throw new Error(await responseError(res, "Usage unavailable."));
    return res.json();
  }, []);
  const loadLibrary = useCallback(async () => {
    const res = await operatorFetch(`${API}/library`);
    if (!res.ok) throw new Error(await responseError(res, "Library unavailable."));
    return (await res.json()).glossaries || [];
  }, []);
  const saveLibrary = useCallback(async (glossaries) => {
    const res = await operatorFetch(`${API}/library`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ glossaries }) });
    if (!res.ok) throw new Error(await responseError(res, "Could not save the library."));
    return (await res.json()).glossaries;
  }, []);
  const dub = useCallback((segments, opts) => dubSegments({ apiBase: API, segments, voice: studioVoice, style: voiceStyle, rules: glossaryRules, ...opts }), [studioVoice, voiceStyle, glossaryRules]);
  const addRelay = useCallback((d) => relayRef.current.add(d), []);
  const removeRelay = useCallback((id) => relayRef.current.remove(id), []);

  // Transcripts per language: primary target, extra channels, and the source.
  const transcripts = useCallback(() => {
    const out = [{ key: "source", lang: sourceLang === "auto" ? "src" : sourceLang, label: "Source", recorder: recordersRef.current.source }];
    out.push({ key: targetLang, lang: targetLang, label: getTarget(targetLang).name, recorder: recordersRef.current.target });
    const extra = new Map(broadcast.archiveRef.current);
    for (const ch of broadcast.extrasRef.current.values()) extra.set(ch.lang, ch.recorder);
    for (const [lang, recorder] of extra) out.push({ key: lang, lang, label: getTarget(lang).name, recorder });
    return out;
  }, [sourceLang, targetLang, broadcast.extrasRef, broadcast.archiveRef]);

  // Stream input (RTMP / SRT): needs an event, connected from a click.
  const eventIdForStream = broadcast.eventInfo?.id;
  const connectStream = useCallback(async () => {
    if (!eventIdForStream) throw new Error("Create or resume an event first: the stream key belongs to the event.");
    const input = new StreamInput({
      eventId: eventIdForStream,
      onStatus: (st) => setStreamState((x) => ({ ...x, connected: st.connected, live: st.live, error: st.error || "" })),
      onLevel: (lv) => setStreamState((x) => (Math.abs(x.level - lv) > 0.01 ? { ...x, level: lv } : x)),
    });
    setStreamInput(input);
    await input.start();
    setCaptureSourceState("stream");
  }, [eventIdForStream]);
  const setCaptureSource = useCallback(async (src) => {
    if (src === "stream") return connectStream();
    setStreamInput(null);
    setStreamState({ connected: false, live: false, error: "", level: 0 });
    setCaptureSourceState("mic");
    return undefined;
  }, [connectStream]);
  useEffect(() => {
    if (!eventIdForStream) { setIngestInfo(null); if (getStreamInput()) setCaptureSource("mic"); return; }
    fetchIngest(eventIdForStream).then(setIngestInfo).catch(() => setIngestInfo(null));
  }, [eventIdForStream]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => setStreamInput(null), []);
  const rotateIngest = useCallback(async () => {
    if (!eventIdForStream) return;
    setIngestInfo(await fetchIngest(eventIdForStream, true));
  }, [eventIdForStream]);

  // Server archive (opt-in per event): upload every minute and when stopping.
  const archiveNow = useCallback(async () => {
    const ev = broadcast.eventInfo;
    if (!ev?.archive) return false;
    const rows = transcripts().filter((r) => !r.recorder.empty);
    try {
      for (const row of rows) {
        const segments = row.recorder.all().slice(-8000).map((x) => ({
          start: x.start, end: x.end, text: applyGlossary(x.text, glossaryRulesRef.current, row.lang).slice(0, 4000), speaker: x.speaker || null,
        }));
        const res = await operatorFetch(`${API}/events/${encodeURIComponent(ev.id)}/transcripts/${encodeURIComponent(row.lang)}`, {
          method: "PUT", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ segments, source_lang: row.key === "source" ? null : (sourceLang === "auto" ? null : sourceLang) }),
        });
        if (!res.ok) throw new Error(await responseError(res, "Transcript archive failed."));
      }
      setArchiveState({ at: Date.now(), error: "" });
      return true;
    } catch (e) { setArchiveState((a) => ({ ...a, error: e.message })); return false; }
  }, [broadcast.eventInfo, transcripts, sourceLang]);
  const archiveRefFn = useRef(archiveNow);
  archiveRefFn.current = archiveNow;
  useEffect(() => {
    if (!broadcast.broadcasting || !broadcast.eventInfo?.archive) return undefined;
    const iv = setInterval(() => archiveRefFn.current(), 60000);
    return () => { clearInterval(iv); archiveRefFn.current(); };
  }, [broadcast.broadcasting, broadcast.eventInfo?.archive]);

  const summarize = useCallback(async ({ text, lang }) => {
    const res = await operatorFetch(`${API}/summary`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: applyGlossary(text, glossaryRules, lang).slice(-190000), language: lang, title: profile.eventName || broadcast.eventInfo?.name || null }),
    });
    if (!res.ok) throw new Error(await responseError(res, "The summary could not be created."));
    return (await res.json()).summary;
  }, [glossaryRules, profile.eventName, broadcast.eventInfo]);

  useEffect(() => () => {
    engineRef.current.stop();
    engineRef.current.stopTest();
    clearInterval(timerRef.current);
  }, []);

  const value = {
    status, sourceText, targetText, logs, rawEvents, error, active,
    translationMuted, inputMuted, duration, translatedSeconds,
    devices, selectedDevice, setSelectedDevice, captureSource,
    outputDevices, selectedOutput, setOutputDevice, outputSupported: engineRef.current.outputSupported(),
    ambientMode, setAmbientMode,
    targetLang, setTargetLang, modeKey, setModeKey, customInstructions, setCustomInstructions,
    sourceLang, setSourceLang,
    profile, setProfile, saveTranscripts, setSaveTranscripts,
    level, testing, metrics,
    start, stop, restart, reset,
    ...broadcast,
    toggleTranslationMute, toggleInputMute: () => setMicMuted(!inputMutedRef.current), testInput, stopTest,
    setMicMuted, pttEnabled, setPttEnabled, autoStopMinutes, setAutoStopMinutes,
    setCaptureSource, streamState, ingestInfo, rotateIngest,
    idleStopMinutes, setIdleStopMinutes, pttKey, setPttKey, speaker, setSpeaker, archiveNow, archiveState,
    relayDestinations, addRelay, removeRelay, fetchUsage, loadLibrary, saveLibrary, dub, humanLangs, setHumanLangs,
    clearError: () => setError(null),
    voiceMode, setVoiceMode, studioVoice, setStudioVoice, voiceStyleKey, setVoiceStyleKey,
    customVoiceStyle, setCustomVoiceStyle, glossary, setGlossary, previewVoice, previewing,
    extraLangs, setExtraLangs, transcripts, summarize,
    MODES,
  };

  return (
    <Ctx.Provider value={value}>
      {children}
      <audio ref={audioRef} autoPlay />
    </Ctx.Provider>
  );
}
