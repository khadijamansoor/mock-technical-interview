"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { startGreeting } from "@/app/actions";

declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

type Turn = {
  id?: string;
  speaker: string;
  content: string;
  question_id?: string | null;
  eval_json?: any;
};

export default function ChatInterface({ 
  sessionId, 
  initialTurns, 
  initialQuestionId,
  status: initialStatus,
  candidateName: initialName,
}: { 
  sessionId: string; 
  initialTurns: Turn[]; 
  initialQuestionId: string | null;
  status: string;
  candidateName: string | null;
}) {
  const [turns, setTurns] = useState<Turn[]>(initialTurns);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [currentQuestionId, setCurrentQuestionId] = useState(initialQuestionId);
  const [status, setStatus] = useState(initialStatus);
  const [candidateName, setCandidateName] = useState(initialName);
  const [scorecardReady, setScorecardReady] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [isListening, setIsListening] = useState(false);
  const [isAutoSubmitting, setIsAutoSubmitting] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [interimText, setInterimText] = useState("");
  
  // Media & Layout State
  const [hasCameraConsent, setHasCameraConsent] = useState(false);
  const [isCameraEnabled, setIsCameraEnabled] = useState(true);
  const [callDuration, setCallDuration] = useState(0);
  
  const recognitionRef = useRef<any>(null);
  const finalTranscriptRef = useRef("");
  const autoSubmitTimerRef = useRef<NodeJS.Timeout | null>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const clearAutoSubmit = useCallback(() => {
    if (autoSubmitTimerRef.current) {
      clearTimeout(autoSubmitTimerRef.current);
      autoSubmitTimerRef.current = null;
    }
    setIsAutoSubmitting(false);
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [turns]);

  // Timer logic
  useEffect(() => {
    if (status === "in_progress" && !timerIntervalRef.current) {
      timerIntervalRef.current = setInterval(() => {
        setCallDuration(prev => prev + 1);
      }, 1000);
    } else if (status === "completed" && timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
    return () => {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
    };
  }, [status]);

  // Poll for scorecard when interview completes
  useEffect(() => {
    if (status !== "completed") return;
    let cancelled = false;
    
    const poll = async () => {
      while (!cancelled) {
        try {
          const res = await fetch(`/api/scorecard?sessionId=${sessionId}`);
          if (res.ok) {
            setScorecardReady(true);
            return;
          }
        } catch { /* ignore */ }
        await new Promise(r => setTimeout(r, 3000));
      }
    };
    poll();
    return () => { cancelled = true; };
  }, [status, sessionId]);

  const hasSpokenGreetingRef = useRef(false);

  const speakText = useCallback((text: string) => {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    
    // TTS always wins: stop recognition immediately to prevent echo.
    // (Barge-in/interrupt is out of scope for Web Speech API and deferred to the real WebRTC voice pipeline)
    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort();
      } catch (e) {}
    }
    setIsListening(false);
    clearAutoSubmit();
    setIsSpeaking(true);

    const cleanText = text.replace(/\*/g, "");
    const utterance = new SpeechSynthesisUtterance(cleanText);
    
    const handleSpeakEnd = () => {
      // 400ms buffer to allow speaker/mic echo and audio tail-off to dissipate
      setTimeout(() => {
        setIsSpeaking(false);
      }, 400);
    };

    utterance.onend = handleSpeakEnd;
    utterance.onerror = handleSpeakEnd;

    window.speechSynthesis.speak(utterance);
  }, [clearAutoSubmit]);

  useEffect(() => {
    if (hasCameraConsent && isCameraEnabled && localVideoRef.current && streamRef.current) {
      console.log("Binding MediaStream to <video> element:", streamRef.current.id);
      localVideoRef.current.srcObject = streamRef.current;
    }
  }, [hasCameraConsent, isCameraEnabled]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (SpeechRecognition) {
        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        
        recognition.onresult = (event: any) => {
          clearAutoSubmit();
          
          let interimTranscript = "";
          let isFinalJustHappened = false;
          
          for (let i = event.resultIndex; i < event.results.length; ++i) {
            if (event.results[i].isFinal) {
              finalTranscriptRef.current += event.results[i][0].transcript + " ";
              isFinalJustHappened = true;
            } else {
              interimTranscript += event.results[i][0].transcript;
            }
          }
          
          setInterimText(interimTranscript);
          const newInput = finalTranscriptRef.current + interimTranscript;
          setInput(newInput);
          
          // Grace period for auto-submit if the speech has settled on a final phrase
          if (isFinalJustHappened && !interimTranscript && newInput.trim()) {
            setIsAutoSubmitting(true);
            autoSubmitTimerRef.current = setTimeout(() => {
              setIsAutoSubmitting(false);
              // By the time this runs, we want to submit whatever is fully transcribed.
              // We dispatch a custom event or call a function, but since handleSubmit
              // might have stale state if used directly in this closure, we will
              // trigger a programmatic form submit using a ref or just call handleSubmit
              // with the final transcript string.
              triggerAutoSubmit(finalTranscriptRef.current);
            }, 1500);
          }
        };
        
        recognition.onend = () => {
          setIsListening(false);
        };
        recognition.onerror = () => {
          clearAutoSubmit();
          setIsListening(false);
        };
        recognitionRef.current = recognition;
      }
    }
    
    return () => {
          clearAutoSubmit();
          window.speechSynthesis?.cancel();
        };
      }, [clearAutoSubmit]);

  const toggleListening = () => {
    if (isSpeaking) return; // Guard against starting while TTS is playing
    clearAutoSubmit();
    
    // Toggle the actual MediaStream audio track (for future WebRTC compatibility)
    if (streamRef.current) {
      const audioTrack = streamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !isListening;
      }
    }

    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
    } else {
      finalTranscriptRef.current = "";
      setInput("");
      setInterimText("");
      recognitionRef.current?.start();
      setIsListening(true);
      window.speechSynthesis?.cancel();
    }
  };

  const toggleCamera = () => {
    if (streamRef.current) {
      const videoTrack = streamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsCameraEnabled(videoTrack.enabled);
      }
    }
  };

  const requestMediaConsent = async () => {
    try {
      console.log("Requesting camera/mic permissions...");
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      console.log("MediaStream acquired successfully:", stream.id);
      streamRef.current = stream;
      setHasCameraConsent(true);
      
      // Trigger greeting creation ONLY after consent, if it's a new session
      if (turns.length === 0) {
        try {
          const greetingText = await startGreeting(sessionId);
          setTurns([{ speaker: 'interviewer', content: greetingText }]);
          hasSpokenGreetingRef.current = true;
          speakText(greetingText);
        } catch (e) {
          console.error("Failed to start greeting:", e);
        }
      }
    } catch (err) {
      console.error("Failed to get media access:", err);
      alert("Camera and microphone access is required for the interview setup.");
    }
  };

  // A stable ref so the timeout closure can call it without stale closures
  const triggerAutoSubmit = (message: string) => {
    handleSubmit(undefined, message);
  };

  const handleSubmit = async (e?: React.FormEvent, explicitMessage?: string) => {
    if (e) e.preventDefault();
    clearAutoSubmit();
    
    const userMessage = (explicitMessage ?? input).trim();
    if (!userMessage || isLoading || status === 'completed') return;

    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      setInterimText("");
    }

    setInput("");
    finalTranscriptRef.current = "";
    setInterimText("");
    setIsLoading(true);

    // Optimistically add user turn
    setTurns(prev => [...prev, { speaker: "candidate", content: userMessage }]);
    // Add empty assistant turn that will be streamed into
    setTurns(prev => [...prev, { speaker: "interviewer", content: "" }]);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          answer: userMessage,
          currentQuestionId
        }),
      });

      if (!res.ok) throw new Error("Network response was not ok");

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      if (!reader) throw new Error("No reader available");

      let done = false;
      let streamedContent = "";

      while (!done) {
        const { value, done: readerDone } = await reader.read();
        done = readerDone;
        if (value) {
          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split('\n');
          
          for (const line of lines) {
            if (line.startsWith('data: ') && line !== 'data: [DONE]') {
              try {
                const data = JSON.parse(line.slice(6));
                
                if (data.type === 'metadata') {
                  setCurrentQuestionId(data.nextQuestionId);
                  if (data.action === 'end') {
                     setStatus('completed');
                  } else if (data.action === 'greeting_done') {
                     setStatus('in_progress');
                  }
                  
                  setTurns(prev => {
                    const newTurns = [...prev];
                    const lastTurn = newTurns[newTurns.length - 1];
                    lastTurn.eval_json = data.eval_json;
                    return newTurns;
                  });
                } else if (data.type === 'text') {
                  streamedContent += data.text;
                  setTurns(prev => {
                    const newTurns = [...prev];
                    newTurns[newTurns.length - 1].content = streamedContent;
                    return newTurns;
                  });
                }
              } catch (e) {
                // Ignore parse errors for incomplete chunks
              }
            }
          }
        }
      }

      // Speak AI response
      if (streamedContent) {
        speakText(streamedContent);
      }
    } catch (error) {
      console.error("Error sending message:", error);
      setTurns(prev => {
        const newTurns = [...prev];
        newTurns[newTurns.length - 1].content = "Error: Failed to get response.";
        return newTurns;
      });
    } finally {
      setIsLoading(false);
    }
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const getTurnSplit = (turn: Turn) => {
    if (!turn || !turn.content) return { feedback: "", caption: "" };
    if (turn.speaker !== 'interviewer') return { feedback: "", caption: turn.content };
    
    const action = turn.eval_json?.action;
    if (action === 'probe' || action === 'greeting_done' || !action) {
      return { feedback: "", caption: turn.content };
    } else {
      const parts = turn.content.split('\n\n');
      if (parts.length > 1) {
        return { feedback: parts[0], caption: parts.slice(1).join('\n\n') };
      } else {
        return { feedback: parts[0], caption: "" };
      }
    }
  };

  if (!hasCameraConsent) {
    return (
      <div className="flex flex-col h-full bg-gray-950 items-center justify-center p-6 text-center">
        <div className="max-w-md w-full bg-gray-900 border border-gray-800 rounded-2xl shadow-2xl p-10 space-y-6">
          <div className="w-20 h-20 bg-blue-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-10 h-10 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-white">Mock Interview Setup</h2>
          <p className="text-gray-400">
            Camera is used to show your own view during the call. Your microphone is needed to talk to Jasmine.
          </p>
          <button
            onClick={requestMediaConsent}
            className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 px-4 rounded-xl shadow-lg transition-all"
          >
            Allow Camera & Microphone
          </button>
        </div>
      </div>
    );
  }

  const activeTurn = turns.length > 0 ? turns[turns.length - 1] : null;
  const activeSplit = activeTurn ? getTurnSplit(activeTurn) : { feedback: "", caption: "" };

  return (
    <div className="flex flex-col h-full bg-black relative">
      <div className="flex flex-1 overflow-hidden">
        {/* Main Video Stage */}
        <div className="flex-1 relative bg-gray-900 flex flex-col items-center justify-center">
          
          {/* Jasmine Avatar / Stage */}
          <div className="flex flex-col items-center space-y-6 z-10">
            <div className="w-48 h-48 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-600 shadow-2xl flex items-center justify-center border-4 border-gray-800 relative">
              <span className="text-6xl font-bold text-white tracking-widest shadow-sm">J</span>
              {isSpeaking && (
                <div className="absolute inset-0 rounded-full border-4 border-blue-400 animate-ping opacity-20"></div>
              )}
            </div>
            <div className="bg-gray-800/80 backdrop-blur-sm px-6 py-2 rounded-full shadow-lg border border-gray-700/50">
              <span className="text-white font-medium tracking-wide">Jasmine (Interviewer)</span>
            </div>
          </div>

          {/* Active Captions Overlay */}
          {activeTurn?.speaker === 'interviewer' && activeSplit.caption && (
            <div className="absolute bottom-24 max-w-4xl w-full px-12 z-20">
              <div className="bg-black/60 backdrop-blur-md px-8 py-5 rounded-2xl border border-white/10 text-center shadow-2xl">
                <p className="text-white/95 text-xl font-medium leading-relaxed">
                  {activeSplit.caption}
                </p>
              </div>
            </div>
          )}

          {/* Candidate PiP (Self-View) */}
          <div className="absolute top-6 right-6 w-64 aspect-video bg-gray-800 rounded-2xl overflow-hidden shadow-2xl border border-gray-700 z-30">
            {isCameraEnabled ? (
              <video
                ref={localVideoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover transform -scale-x-100"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-gray-900">
                <svg className="w-12 h-12 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              </div>
            )}
            <div className="absolute bottom-2 left-2 bg-black/50 px-2 py-1 rounded text-xs text-white backdrop-blur-sm">
              You
            </div>
          </div>

          {/* Timer Overlay */}
          <div className="absolute top-6 left-6 z-30">
            <div className="bg-gray-900/80 backdrop-blur-sm px-4 py-2 rounded-lg border border-gray-700 flex items-center space-x-2 shadow-lg">
              <div className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse"></div>
              <span className="text-gray-200 font-mono text-sm tracking-widest">
                {status === "in_progress" ? `Live · ${formatTime(callDuration)}` : "Setup"}
              </span>
            </div>
          </div>

        </div>

        {/* Side Panel: Transcript & Feedback */}
        <div className="w-[400px] bg-gray-950 border-l border-gray-800 flex flex-col">
          <div className="p-5 border-b border-gray-800 bg-gray-900/50">
            <h3 className="text-gray-200 font-semibold tracking-wide text-sm uppercase">Interview Log</h3>
          </div>
          <div className="flex-1 overflow-y-auto p-5 space-y-6">
            {turns.map((turn, i) => {
              const split = getTurnSplit(turn);
              const isCandidate = turn.speaker === 'candidate';
              
              // Only show the feedback part in the side panel if it exists for interviewer
              // Otherwise show the full content (or caption) for general log
              const displayContent = turn.speaker === 'interviewer' 
                ? (split.feedback ? split.feedback : split.caption)
                : turn.content;

              if (!displayContent && !isLoading) return null;

              return (
                <div key={i} className={`flex flex-col ${isCandidate ? 'items-end' : 'items-start'}`}>
                  <span className="text-[10px] text-gray-500 mb-1 uppercase font-bold tracking-wider">
                    {isCandidate ? 'You' : 'Feedback'}
                  </span>
                  <div className={`text-sm leading-relaxed p-4 rounded-2xl ${
                    isCandidate 
                      ? 'bg-blue-900/40 border border-blue-800/50 text-blue-100 rounded-tr-sm' 
                      : 'bg-gray-800/60 border border-gray-700 text-gray-300 rounded-tl-sm'
                  }`}>
                    {displayContent || (isLoading && i === turns.length - 1 ? <span className="animate-pulse">...</span> : "")}
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>
        </div>
      </div>

      {/* Bottom Control Bar */}
      <div className="h-24 bg-gray-900 border-t border-gray-800 flex items-center px-6 relative z-30 shadow-2xl">
        {status === 'completed' ? (
          <div className="w-full flex items-center justify-center">
            {scorecardReady ? (
              <a 
                href={`/interview/${sessionId}/scorecard`}
                className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 px-8 rounded-full shadow-lg transform transition-all active:scale-95"
              >
                View Your Scorecard
              </a>
            ) : (
              <div className="flex items-center gap-3 text-gray-400">
                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                <span>Ending call and generating scorecard...</span>
              </div>
            )}
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="w-full flex items-center gap-4 max-w-6xl mx-auto">
            
            {/* AV Controls */}
            <div className="flex items-center gap-2 mr-4">
              <button
                type="button"
                onClick={toggleListening}
                disabled={isLoading || isSpeaking}
                className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${
                  isListening 
                    ? 'bg-red-500 hover:bg-red-600 animate-pulse' 
                    : (isSpeaking || isLoading)
                      ? 'bg-gray-800 opacity-50 cursor-not-allowed'
                      : 'bg-gray-700 hover:bg-gray-600'
                }`}
                title={isSpeaking ? "Jasmine is speaking..." : "Toggle Microphone"}
              >
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                </svg>
              </button>

              <button
                type="button"
                onClick={toggleCamera}
                className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${
                  !isCameraEnabled ? 'bg-red-500 hover:bg-red-600' : 'bg-gray-700 hover:bg-gray-600'
                }`}
                title="Toggle Camera"
              >
                <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  {isCameraEnabled ? (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  ) : (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z M3 3l18 18" />
                  )}
                </svg>
              </button>
            </div>
            {/* Text Input */}
            <div 
              className={`flex-1 flex items-center bg-gray-800/80 border ${isListening ? 'border-red-500' : 'border-gray-700'} rounded-full px-5 py-2 focus-within:ring-2 focus-within:ring-blue-500 transition-all cursor-text relative overflow-hidden`}
              onClick={() => inputRef.current?.focus()}
            >
              {isListening && (
                <div className="absolute inset-0 px-5 flex items-center pointer-events-none w-full text-sm whitespace-nowrap overflow-hidden text-ellipsis text-left">
                  {finalTranscriptRef.current === "" && interimText === "" ? (
                     <span className="text-gray-500">Listening...</span>
                  ) : (
                     <>
                       <span className="text-white">{finalTranscriptRef.current}</span>
                       <span className="text-gray-400 italic">{interimText}</span>
                     </>
                  )}
                </div>
              )}

              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => {
                   clearAutoSubmit();
                   if (isListening) {
                     recognitionRef.current?.stop();
                     setIsListening(false);
                     setInterimText("");
                   }
                   setInput(e.target.value);
                   finalTranscriptRef.current = e.target.value;
                }}
                onFocus={() => {
                  if (isAutoSubmitting) {
                    clearAutoSubmit();
                  }
                  if (isListening) {
                    recognitionRef.current?.stop();
                    setIsListening(false);
                    setInterimText("");
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleSubmit();
                  }
                }}
                placeholder={isListening ? "" : "Type a message..."}
                className={`w-full bg-transparent text-white focus:outline-none text-sm placeholder-gray-500 ${isListening ? 'opacity-0' : 'opacity-100'}`}
                disabled={isLoading}
              />
            </div>

            {/* Send Button */}
            <button
              type="submit"
              disabled={isLoading || !input.trim()}
              className={`px-6 py-2.5 rounded-full font-medium transition-all flex-shrink-0 ${
                isAutoSubmitting
                  ? 'bg-amber-500 hover:bg-amber-400 animate-pulse text-white shadow-lg shadow-amber-500/20'
                  : 'bg-blue-600 hover:bg-blue-500 disabled:bg-gray-800 disabled:text-gray-600 text-white'
              }`}
            >
              {isLoading ? '...' : isAutoSubmitting ? 'Sending...' : 'Send'}
            </button>
            
            {/* End Call Button */}
            <button
              type="button"
              onClick={() => {
                // Call end endpoint or just trigger a dummy action to force completion
                if(confirm("Are you sure you want to end the interview early?")) {
                  handleSubmit(undefined, "I need to end the interview now.");
                }
              }}
              className="ml-4 w-12 h-12 rounded-full bg-red-600 hover:bg-red-500 flex items-center justify-center transition-all shadow-lg shadow-red-900/20"
              title="End Call"
            >
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 8l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2M5 3a2 2 0 00-2 2v1c0 8.284 6.716 15 15 15h1a2 2 0 002-2v-3.28a1 1 0 00-.684-.948l-4.493-1.498a1 1 0 00-1.21.502l-1.13 2.257a11.042 11.042 0 01-5.516-5.517l2.257-1.128a1 1 0 00.502-1.21L9.228 3.683A1 1 0 008.279 3H5z" />
              </svg>
            </button>

          </form>
        )}
      </div>
    </div>
  );
}
