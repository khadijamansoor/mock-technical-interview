"use client";

import { useState, useRef, useEffect, useCallback } from "react";

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
  const recognitionRef = useRef<any>(null);
  const finalTranscriptRef = useRef("");

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [turns]);

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
    const cleanText = text.replace(/\*/g, "");
    const utterance = new SpeechSynthesisUtterance(cleanText);
    window.speechSynthesis.speak(utterance);
  }, []);

  // Centralized TTS trigger for initial greeting (handles browser autoplay policies)
  useEffect(() => {
    const greetingTurn = initialTurns.find(t => t.speaker === 'interviewer');
    if (!greetingTurn || !greetingTurn.content || hasSpokenGreetingRef.current) return;

    const trySpeakGreeting = () => {
      if (hasSpokenGreetingRef.current) return;
      hasSpokenGreetingRef.current = true;
      speakText(greetingTurn.content);
    };

    trySpeakGreeting();

    // Fallback: If autoplay policy blocked TTS on page load, trigger on first user interaction
    const handleFirstInteraction = () => {
      if (window.speechSynthesis && !window.speechSynthesis.speaking) {
        speakText(greetingTurn.content);
      }
      window.removeEventListener('click', handleFirstInteraction);
      window.removeEventListener('keydown', handleFirstInteraction);
      window.removeEventListener('touchstart', handleFirstInteraction);
    };

    window.addEventListener('click', handleFirstInteraction);
    window.addEventListener('keydown', handleFirstInteraction);
    window.addEventListener('touchstart', handleFirstInteraction);

    return () => {
      window.removeEventListener('click', handleFirstInteraction);
      window.removeEventListener('keydown', handleFirstInteraction);
      window.removeEventListener('touchstart', handleFirstInteraction);
    };
  }, [initialTurns, speakText]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (SpeechRecognition) {
        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        
        recognition.onresult = (event: any) => {
          let interimTranscript = "";
          for (let i = event.resultIndex; i < event.results.length; ++i) {
            if (event.results[i].isFinal) {
              finalTranscriptRef.current += event.results[i][0].transcript + " ";
            } else {
              interimTranscript += event.results[i][0].transcript;
            }
          }
          setInput(finalTranscriptRef.current + interimTranscript);
        };
        
        recognition.onend = () => setIsListening(false);
        recognition.onerror = () => setIsListening(false);
        recognitionRef.current = recognition;
      }
    }
    
    return () => {
      window.speechSynthesis?.cancel();
    };
  }, []);

  const toggleListening = () => {
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
    } else {
      finalTranscriptRef.current = "";
      setInput("");
      recognitionRef.current?.start();
      setIsListening(true);
      window.speechSynthesis?.cancel();
    }
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!input.trim() || isLoading || status === 'completed') return;

    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
    }

    const userMessage = input.trim();
    setInput("");
    finalTranscriptRef.current = "";
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

  return (
    <div className="flex flex-col h-full bg-gray-950">
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {turns.map((turn, i) => (
          <div key={i} className={`flex ${turn.speaker === 'candidate' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-3xl rounded-2xl p-5 shadow-sm ${
              turn.speaker === 'candidate' 
                ? 'bg-blue-600 text-white rounded-br-none' 
                : 'bg-gray-800 text-gray-100 border border-gray-700 rounded-bl-none'
            }`}>
              <div className="text-xs opacity-50 mb-1 flex justify-between items-center">
                <span>{turn.speaker === 'candidate' ? (candidateName || 'You') : 'Jasmine'}</span>
                
                {/* Debug View for State Machine */}
                {turn.speaker === 'interviewer' && turn.eval_json && (
                  <span className="ml-4 bg-gray-900 px-2 py-1 rounded text-green-400 font-mono">
                    Action: {turn.eval_json.action}
                  </span>
                )}
              </div>
              
              <div className="whitespace-pre-wrap leading-relaxed">
                {turn.content || (isLoading && i === turns.length - 1 ? "..." : "")}
              </div>

              {/* Debug View for Scores */}
              {turn.speaker === 'interviewer' && turn.eval_json?.score && (
                <div className="mt-3 pt-3 border-t border-gray-700 text-xs text-gray-400 font-mono">
                  Scores: C:{turn.eval_json.score.correctness} D:{turn.eval_json.score.depth} S:{turn.eval_json.score.communication}
                </div>
              )}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      <div className="p-4 bg-gray-900 border-t border-gray-800">
        {status === 'completed' ? (
          <div className="text-center p-4">
            {scorecardReady ? (
              <a 
                href={`/interview/${sessionId}/scorecard`}
                className="inline-block bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-400 hover:to-emerald-500 text-white font-bold py-3 px-8 rounded-xl shadow-lg transform transition-all active:scale-95"
              >
                View Your Scorecard →
              </a>
            ) : (
              <div className="flex items-center justify-center gap-3 text-gray-400">
                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                <span>Jasmine is generating your scorecard...</span>
              </div>
            )}
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="max-w-4xl mx-auto flex gap-3 items-end">
            <button
              type="button"
              onClick={toggleListening}
              disabled={isLoading}
              className={`p-3 rounded-xl transition-all flex-shrink-0 ${
                isListening 
                  ? 'bg-red-500 hover:bg-red-600 animate-pulse' 
                  : 'bg-gray-700 hover:bg-gray-600'
              }`}
              title="Toggle Microphone"
            >
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
              </svg>
            </button>
            <textarea
              value={input}
              onChange={(e) => {
                 setInput(e.target.value);
                 finalTranscriptRef.current = e.target.value;
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmit();
                }
              }}
              placeholder={isListening ? "Listening..." : "Type your answer... (Press Enter to submit)"}
              className={`flex-1 bg-gray-800 border ${isListening ? 'border-red-500' : 'border-gray-700'} rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none transition-colors`}
              rows={2}
              disabled={isLoading || isListening}
            />
            <button
              type="submit"
              disabled={isLoading || !input.trim()}
              className="bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 disabled:text-gray-500 text-white px-6 py-3 rounded-xl font-medium transition-colors h-[50px] flex-shrink-0"
            >
              {isLoading ? '...' : 'Send'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
