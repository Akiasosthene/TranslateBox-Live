import { operatorFetch, responseError } from "../lib/api";
import { useState, useRef, useCallback, useEffect } from "react";
import { OperatorBroadcaster, WS_BASE } from "../lib/broadcast";
import { ExtraChannel } from "../lib/extraChannel";
import { SourceChannel } from "../lib/sourceChannel";
import { isCascade } from "../lib/languages";
import { usePersistentState } from "./usePersistentState";

// Broadcast: the operator's translated program audio is fanned out to many
// listeners through the backend WebSocket hub. A multi-language event adds one
// ExtraChannel per additional language (its own OpenAI session from the same
// microphone). Listeners never touch OpenAI.
export function useBroadcast({
  API, engineRef, targetLang, profile, start, stop, setError, targetText, active, setTargetLang,
  voiceMeta, extraLangs, setExtraLangs, channelStartArgs, channelVoiceConfig, keepTranscripts,
  humanLangs = [], setHumanLangs = () => {}, onExtraSegment = () => {}, micMuted = false,
}) {
  const [savedEvents, setSavedEvents] = useState([]);
  const [catalogError, setCatalogError] = useState("");
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [eventInfo, setEventInfo] = useState(null);
  const [listeners, setListeners] = useState(0);
  const [primaryListeners, setPrimaryListeners] = useState(0);
  const [broadcasting, setBroadcasting] = useState(false);
  const [channels, setChannels] = useState([]);
  const [captionsToListeners, setCaptionsToListeners] = usePersistentState("tbl-listener-captions", false);
  const broadcasterRef = useRef(null);
  const generationRef = useRef(0);
  const extrasRef = useRef(new Map());
  // Transcripts of stopped extra channels, kept only when the operator opted in.
  const archiveRef = useRef(new Map());
  const keepRef = useRef(keepTranscripts);
  keepRef.current = keepTranscripts;
  const voiceMetaRef = useRef(voiceMeta);
  voiceMetaRef.current = voiceMeta;
  const voiceCfgRef = useRef(channelVoiceConfig);
  voiceCfgRef.current = channelVoiceConfig;
  const startArgsRef = useRef(channelStartArgs);
  startArgsRef.current = channelStartArgs;
  const sourceRef = useRef(null);
  const segmentRef = useRef(onExtraSegment);
  segmentRef.current = onExtraSegment;
  const micMutedRef = useRef(micMuted);
  micMutedRef.current = micMuted;
  const captionsRef = useRef(captionsToListeners);
  captionsRef.current = captionsToListeners;

  const channelsKeyRef = useRef("");
  const snapshotChannels = useCallback(() => {
    // Called on every transcript delta: only re-render when status changes.
    const list = [...extrasRef.current.values()].map((c) => ({ lang: c.lang, state: c.state, listeners: c.listeners }));
    const key = JSON.stringify(list);
    if (key === channelsKeyRef.current) return;
    channelsKeyRef.current = key;
    setChannels(list);
  }, []);

  // Text-pipeline languages (translated + voiced on the server from the source sentences).
  const cascadeRef = useRef(null); // { id, timer }
  const [cascadeLive, setCascadeLive] = useState(false);
  const stopCascade = useCallback(() => {
    const c = cascadeRef.current;
    cascadeRef.current = null;
    setCascadeLive(false);
    if (!c) return;
    clearInterval(c.timer);
    operatorFetch(`${API}/events/${encodeURIComponent(c.id)}/cascade/stop`, { method: "POST" }).catch(() => {});
  }, [API]);
  const startCascade = useCallback(async (event) => {
    const langs = (event.targets || []).filter((l) => isCascade(l) && !(event.human || []).includes(l));
    if (!langs.length) return;
    const cfg = voiceCfgRef.current || {};
    const res = await operatorFetch(`${API}/events/${encodeURIComponent(event.id)}/cascade/start`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ voice: cfg.voice || "marin", style: (cfg.style || "").slice(0, 400) }),
    });
    if (!res.ok) throw new Error(await responseError(res, "The text-pipeline languages could not start."));
    const ping = () => operatorFetch(`${API}/events/${encodeURIComponent(event.id)}/cascade/segment`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: "" }),
    }).catch(() => {});
    cascadeRef.current = { id: event.id, timer: setInterval(ping, 60000) };
    setCascadeLive(true);
  }, [API]);
  const sendSourceSegment = useCallback((text, speaker) => {
    const c = cascadeRef.current;
    if (!c || !text?.trim()) return;
    operatorFetch(`${API}/events/${encodeURIComponent(c.id)}/cascade/segment`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: text.trim().slice(0, 2000), speaker: speaker || null }),
    }).catch(() => {});
  }, [API]);

  const stopExtras = useCallback(() => {
    stopCascade();
    sourceRef.current?.stop();
    sourceRef.current = null;
    for (const ch of extrasRef.current.values()) {
      ch.stop();
      if (keepRef.current && !ch.recorder.empty) archiveRef.current.set(ch.lang, ch.recorder);
    }
    extrasRef.current.clear();
    channelsKeyRef.current = "[]";
    setChannels([]);
  }, [stopCascade]);

  const startExtras = useCallback(async (event) => {
    stopExtras();
    const human = new Set(event.human || []);
    const langs = (event.targets || [event.target]).slice(1).filter((l) => !human.has(l) && !isCascade(l));
    startCascade(event).catch((e) => setError(e.message));
    const generation = generationRef.current;
    archiveRef.current.clear();
    if (human.size) {
      // Human interpreters need the untranslated floor audio.
      const src = new SourceChannel({ onError: setError });
      sourceRef.current = src;
      const args = startArgsRef.current(event.target);
      src.start({ event, deviceId: args.deviceId, ambient: args.ambient, source: args.source })
        .then(() => src.setMuted(micMutedRef.current))
        .catch((e) => setError("Interpreter booth feed could not start: " + e.message));
    }
    if (!langs.length) return;
    for (const lang of langs) {
      const ch = new ExtraChannel({ apiBase: API, lang, onChange: snapshotChannels, onError: setError, onSegment: (l, text) => segmentRef.current(l, text) });
      ch.configure({ ...(voiceCfgRef.current || {}), captions: captionsRef.current });
      extrasRef.current.set(lang, ch);
    }
    snapshotChannels();
    const list = [...extrasRef.current.values()];
    const results = await Promise.allSettled(list.map((ch) => ch.start({ event, ...startArgsRef.current(ch.lang) }).then(() => ch.setInputMuted(micMutedRef.current))));
    if (generation !== generationRef.current) { stopExtras(); return; }
    results.forEach((r, i) => {
      if (r.status === "rejected" && r.reason?.message !== "cancelled") {
        setError(`${list[i].lang.toUpperCase()}: ${r.reason?.message || "channel failed to start"}`);
      }
    });
    snapshotChannels();
  }, [API, setError, snapshotChannels, stopExtras, startCascade]);

  const _attach = useCallback(async (event) => {
    const generation = ++generationRef.current;
    const engine = engineRef.current;
    await engine.programReady;
    const program = engine.program;
    if (!program?.ctx || !program.output) throw new Error("Translated audio is not available yet. Start translation and retry.");
    const url = `${WS_BASE}/api/ws/${event.id}?role=operator&lang=${encodeURIComponent(event.target)}`;
    const b = new OperatorBroadcaster(url, {
      token: event.operator_token,
      onCount: (count, total) => { setPrimaryListeners(count); setListeners(total); },
      onStatus: (status) => { setBroadcasting(false); setListeners(0); setPrimaryListeners(0); if (status.error) setError(status.error); },
    });
    broadcasterRef.current?.stop();
    broadcasterRef.current = b;
    await b.start(program);
    if (generation !== generationRef.current) { b.stop(); return false; }
    b.sendMeta(voiceMetaRef.current || {});
    setBroadcasting(true);
    return true;
  }, [engineRef, setError]);

  const _detach = useCallback(() => {
    generationRef.current += 1;
    if (broadcasterRef.current) { broadcasterRef.current.stop(); broadcasterRef.current = null; }
    stopExtras();
    setBroadcasting(false);
  }, [stopExtras]);

  const refreshEvents = useCallback(async () => {
    setCatalogLoading(true);
    try {
      const response = await operatorFetch(`${API}/events`);
      if (!response.ok) throw new Error(await responseError(response, "Could not load saved events."));
      setSavedEvents((await response.json()).events);
      setCatalogError("");
    } catch (error) { setCatalogError(error.message); }
    finally { setCatalogLoading(false); }
  }, [API]);

  useEffect(() => { refreshEvents(); }, [refreshEvents]);

  const resumeEvent = useCallback(async (id) => {
    if (active || broadcasting) throw new Error("Stop the current session before selecting another event.");
    const response = await operatorFetch(`${API}/events/${encodeURIComponent(id)}/resume`, {method: "POST"});
    if (!response.ok) throw new Error(await responseError(response, "Could not resume this event."));
    const event = await response.json();
    setEventInfo(event);
    setTargetLang(event.target);
    setExtraLangs((event.targets || [event.target]).slice(1));
    setHumanLangs(event.human || []);
    setCaptionsToListeners(event.captions);
    setListeners(event.listeners);
    await refreshEvents();
    return event;
  }, [API, active, broadcasting, refreshEvents, setTargetLang, setExtraLangs, setHumanLangs, setCaptionsToListeners]);

  // Mic gate for push-to-talk: every channel captures the same microphone.
  const setChannelsMicMuted = useCallback((muted) => {
    for (const ch of extrasRef.current.values()) ch.setInputMuted(muted);
    sourceRef.current?.setMuted(muted);
  }, []);

  const eventRequest = useCallback(async (path, options, fallback) => {
    if (!eventInfo) throw new Error("Create or resume an event first.");
    const res = await operatorFetch(`${API}/events/${encodeURIComponent(eventInfo.id)}${path}`, options);
    if (!res.ok) throw new Error(await responseError(res, fallback));
    return res.json();
  }, [API, eventInfo]);

  const rotateInterpreterCode = useCallback(async () => {
    const { interpreter_code } = await eventRequest("/interpreter-code", { method: "POST" }, "Could not create a booth code.");
    setEventInfo((ev) => ({ ...ev, interpreter_code }));
    return interpreter_code;
  }, [eventRequest]);

  const updateBranding = useCallback(async ({ logo, sponsor }) => {
    const info = await eventRequest("/branding", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ logo: logo || null, sponsor: sponsor || "" }) }, "Could not save the branding.");
    setEventInfo((ev) => ({ ...ev, logo: info.logo, sponsor: info.sponsor }));
  }, [eventRequest]);

  const publishSummary = useCallback(async (lang, text) => {
    const { summaries } = await eventRequest("/summaries", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ lang, text }) }, "Could not publish the summary.");
    setEventInfo((ev) => ({ ...ev, summaries }));
  }, [eventRequest]);

  const unpublishSummary = useCallback(async (lang) => {
    const { summaries } = await eventRequest(`/summaries/${encodeURIComponent(lang)}`, { method: "DELETE" }, "Could not remove the summary.");
    setEventInfo((ev) => ({ ...ev, summaries }));
  }, [eventRequest]);

  const newEvent = useCallback(() => {
    if (active || broadcasting) return;
    setEventInfo(null); setListeners(0); refreshEvents();
  }, [active, broadcasting, refreshEvents]);

  const createEvent = useCallback(async (fields = {}) => {
    const res = await operatorFetch(`${API}/events`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: fields.name || "Live Interpretation",
        organization: fields.organization || profile.organization || "",
        target_language: targetLang,
        extra_languages: (extraLangs || []).filter((l) => l !== targetLang),
        human_languages: (humanLangs || []).filter((l) => (extraLangs || []).includes(l) && l !== targetLang),
        logo: fields.logo || null,
        sponsor: fields.sponsor || "",
        pin: fields.pin || null,
        captions: captionsToListeners,
        archive_transcripts: !!fields.archive,
        ...(fields.start_at ? { start_at: fields.start_at } : {}),
        ...(fields.duration_minutes ? { duration_minutes: fields.duration_minutes } : {}),
        ...(fields.labels?.length ? { labels: fields.labels } : {}),
      }),
    });
    if (!res.ok) throw new Error(await responseError(res, "Could not create event."));
    const info = await res.json();
    setEventInfo(info);
    await refreshEvents();
    return info;
  }, [API, targetLang, extraLangs, humanLangs, captionsToListeners, profile.organization, refreshEvents]);

  const startEvent = useCallback(async (fields) => {
    setError(null);
    if (eventInfo && eventInfo.target !== targetLang) throw new Error("The event language differs from the selected language. Restore the event language before broadcasting.");
    let ev = eventInfo;
    if (!ev) ev = await createEvent(fields || {});
    if (!(await start())) return ev;
    const generation = generationRef.current;
    for (let i = 0; i < 25; i++) {
      if (engineRef.current.program?.hasSource) break;
      await new Promise((r) => setTimeout(r, 200));
    }
    if (!engineRef.current.active || generation !== generationRef.current) return ev;
    try {
      if (await _attach(ev)) await startExtras(ev);
    } catch (e) {
      setError("Broadcast could not start: " + e.message);
    }
    return ev;
  }, [eventInfo, createEvent, start, engineRef, setError, _attach, startExtras, targetLang]);

  const stopEvent = useCallback(() => {
    _detach();
    setListeners(0);
    setPrimaryListeners(0);
    stop();
  }, [_detach, stop]);

  const restartBroadcast = useCallback(async () => {
    if (!eventInfo) return;
    if (broadcasterRef.current) { broadcasterRef.current.stop(); broadcasterRef.current = null; }
    await _attach(eventInfo);
  }, [_attach, eventInfo]);

  useEffect(() => {
    if (broadcasting && broadcasterRef.current) {
      broadcasterRef.current.sendCaption(captionsToListeners ? targetText : "");
    }
  }, [targetText, broadcasting, captionsToListeners]);

  useEffect(() => {
    if (!active) _detach();
  }, [active, _detach]);

  // Voice changes reach listeners as metadata (AI voice disclosure) and apply
  // live to every extra language channel.
  const metaKey = JSON.stringify(voiceMeta || {});
  useEffect(() => {
    if (broadcasting && broadcasterRef.current) broadcasterRef.current.sendMeta(JSON.parse(metaKey));
  }, [metaKey, broadcasting]);
  const cfgKey = JSON.stringify({ ...(channelVoiceConfig || {}), captions: captionsToListeners });
  useEffect(() => {
    const cfg = JSON.parse(cfgKey);
    for (const ch of extrasRef.current.values()) ch.configure(cfg);
  }, [cfgKey]);

  useEffect(() => () => {
    generationRef.current += 1;
    broadcasterRef.current?.stop();
    for (const ch of extrasRef.current.values()) ch.stop();
  }, []);

  return {
    createEvent, startEvent, stopEvent, restartBroadcast,
    savedEvents, catalogError, catalogLoading, refreshEvents, resumeEvent, newEvent,
    eventInfo, listeners, primaryListeners, broadcasting, channels, extrasRef, archiveRef,
    setChannelsMicMuted, rotateInterpreterCode, updateBranding, publishSummary, unpublishSummary,
    captionsToListeners, setCaptionsToListeners, cascadeLive, sendSourceSegment,
  };
}
