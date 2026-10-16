import { operatorFetch, responseError } from "../lib/api";
import { useState, useRef, useCallback, useEffect } from "react";
import { OperatorBroadcaster, WS_BASE } from "../lib/broadcast";
import { usePersistentState } from "./usePersistentState";

// V1 broadcast: ONE operator captures the translated audio stream and fans it
// out to many listeners through the backend WebSocket hub. Listeners never
// touch OpenAI. This hook owns all event/broadcast state for the operator.
export function useBroadcast({ API, engineRef, targetLang, profile, start, stop, setError, targetText, active, setTargetLang, voiceMeta }) {
  const [savedEvents, setSavedEvents] = useState([]);
  const [catalogError, setCatalogError] = useState("");
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [eventInfo, setEventInfo] = useState(null);
  const [listeners, setListeners] = useState(0);
  const [broadcasting, setBroadcasting] = useState(false);
  const [captionsToListeners, setCaptionsToListeners] = usePersistentState("tbl-listener-captions", false);
  const broadcasterRef = useRef(null);
  const generationRef = useRef(0);
  const voiceMetaRef = useRef(voiceMeta);
  voiceMetaRef.current = voiceMeta;

  const _attach = useCallback(async (event) => {
    const generation = ++generationRef.current;
    const engine = engineRef.current;
    await engine.programReady;
    const program = engine.program;
    if (!program?.ctx || !program.output) throw new Error("Translated audio is not available yet. Start translation and retry.");
    const b = new OperatorBroadcaster(`${WS_BASE}/api/ws/${event.id}?role=operator`, { token: event.operator_token, onCount: setListeners, onStatus: (status) => { setBroadcasting(false); setListeners(0); if (status.error) setError(status.error); } });
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
    setBroadcasting(false);
  }, []);

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
    setCaptionsToListeners(event.captions);
    setListeners(event.listeners);
    await refreshEvents();
    return event;
  }, [API, active, broadcasting, refreshEvents, setTargetLang, setCaptionsToListeners]);

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
        pin: fields.pin || null,
        captions: captionsToListeners,
      }),
    });
    if (!res.ok) throw new Error(await responseError(res, "Could not create event."));
    const info = await res.json();
    setEventInfo(info);
    await refreshEvents();
    return info;
  }, [API, targetLang, captionsToListeners, profile.organization, refreshEvents]);

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
      await _attach(ev);
    } catch (e) {
      setError("Broadcast could not start: " + e.message);
    }
    return ev;
  }, [eventInfo, createEvent, start, engineRef, setError, _attach, targetLang]);

  const stopEvent = useCallback(() => {
    _detach();
    setListeners(0);
    stop();
  }, [_detach, stop]);

  const restartBroadcast = useCallback(async () => {
    _detach();
    if (eventInfo) await _attach(eventInfo);
  }, [_detach, _attach, eventInfo]);

  useEffect(() => {
    if (broadcasting && broadcasterRef.current) {
      broadcasterRef.current.sendCaption(captionsToListeners ? targetText : "");
    }
  }, [targetText, broadcasting, captionsToListeners]);

  useEffect(() => {
    if (!active) _detach();
  }, [active, _detach]);

  // Reconnections to OpenAI swap the source inside the program bus, so the
  // broadcast keeps running without re-attaching. Voice changes reach
  // listeners as metadata (AI voice disclosure).
  const metaKey = JSON.stringify(voiceMeta || {});
  useEffect(() => {
    if (broadcasting && broadcasterRef.current) broadcasterRef.current.sendMeta(JSON.parse(metaKey));
  }, [metaKey, broadcasting]);

  useEffect(() => () => { generationRef.current += 1; broadcasterRef.current?.stop(); }, []);

  return {
    createEvent, startEvent, stopEvent, restartBroadcast,
    savedEvents, catalogError, catalogLoading, refreshEvents, resumeEvent, newEvent,
    eventInfo, listeners, broadcasting,
    captionsToListeners, setCaptionsToListeners,
  };
}
