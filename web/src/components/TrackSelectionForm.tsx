"use client";

import { useState } from "react";
import { tracks, Track } from "@/lib/tracks";

type Props = {
  availableCombinations: { role_track: string; round_type: string | null }[];
};

export default function TrackSelectionForm({ availableCombinations }: Props) {
  const [selectedTrackId, setSelectedTrackId] = useState<string>("");
  const [selectedRoundType, setSelectedRoundType] = useState<string>("");

  const isTrackAvailable = (track: Track) => {
    return availableCombinations.some(c => c.role_track === track.id);
  };

  const isRoundTypeAvailable = (trackId: string, roundTypeId: string) => {
    return availableCombinations.some(
      c => c.role_track === trackId && c.round_type === roundTypeId
    );
  };

  const selectedTrack = tracks.find(t => t.id === selectedTrackId);

  // Group tracks by category
  const categories = ["Technical", "Non-engineering", "Cross-cutting", "General Engineering (Legacy)"];

  const handleTrackSelect = (track: Track) => {
    if (!isTrackAvailable(track)) return;
    
    setSelectedTrackId(track.id);
    
    // Auto-select first available round type if applicable
    if (track.roundTypes && track.roundTypes.length > 0) {
      const firstAvailable = track.roundTypes.find(rt => isRoundTypeAvailable(track.id, rt.id));
      setSelectedRoundType(firstAvailable ? firstAvailable.id : "");
    } else {
      setSelectedRoundType("");
    }
  };

  return (
    <div className="space-y-8">
      {/* Hidden inputs to pass state to server action */}
      <input type="hidden" name="role_track" value={selectedTrackId} />
      <input type="hidden" name="round_type" value={selectedRoundType} />

      <div className="space-y-6">
        {categories.map(category => {
          const categoryTracks = tracks.filter(t => t.category === category);
          if (categoryTracks.length === 0) return null;

          return (
            <div key={category} className="space-y-3">
              <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">{category}</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {categoryTracks.map(track => {
                  const available = isTrackAvailable(track);
                  const isSelected = selectedTrackId === track.id;

                  return (
                    <button
                      key={track.id}
                      type="button"
                      onClick={() => handleTrackSelect(track)}
                      disabled={!available}
                      className={`text-left p-4 rounded-xl border transition-all ${
                        !available
                          ? "bg-gray-800/50 border-gray-800 opacity-50 cursor-not-allowed"
                          : isSelected
                            ? "bg-blue-900/30 border-blue-500 ring-1 ring-blue-500"
                            : "bg-gray-800 border-gray-700 hover:border-gray-500 hover:bg-gray-750"
                      }`}
                    >
                      <div className="flex justify-between items-start mb-1">
                        <h4 className={`font-semibold ${isSelected ? "text-blue-400" : "text-gray-200"}`}>
                          {track.name}
                        </h4>
                        {!available && (
                          <span className="text-[10px] uppercase font-bold tracking-wide bg-gray-700 text-gray-400 px-2 py-0.5 rounded">
                            Coming Soon
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-400 line-clamp-2 leading-relaxed">
                        {track.description}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {selectedTrack && selectedTrack.roundTypes && (
        <div className="bg-gray-800/50 border border-gray-700 p-5 rounded-xl space-y-3 animate-in fade-in slide-in-from-top-2">
          <label className="block text-sm font-medium text-gray-300">
            Select Round Type for {selectedTrack.name}
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {selectedTrack.roundTypes.map(rt => {
              const rtAvailable = isRoundTypeAvailable(selectedTrack.id, rt.id);
              const rtSelected = selectedRoundType === rt.id;
              
              return (
                <button
                  key={rt.id}
                  type="button"
                  disabled={!rtAvailable}
                  onClick={() => setSelectedRoundType(rt.id)}
                  className={`px-4 py-2.5 rounded-lg text-sm font-medium transition-colors border ${
                    !rtAvailable
                      ? "bg-gray-800/50 border-gray-800 text-gray-500 cursor-not-allowed"
                      : rtSelected
                        ? "bg-blue-600 border-blue-500 text-white"
                        : "bg-gray-800 border-gray-700 text-gray-300 hover:bg-gray-700"
                  }`}
                >
                  {rt.name}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Legacy controls for topic and difficulty */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">Focus Topic (Optional)</label>
          <input 
            type="text" 
            name="topic" 
            placeholder="e.g. React, System Design, Databases" 
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">Difficulty</label>
          <select 
            name="difficulty" 
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="easy">Easy</option>
            <option value="medium">Medium</option>
            <option value="hard">Hard</option>
          </select>
        </div>
      </div>

      <button 
        type="submit" 
        disabled={!selectedTrackId || (!!selectedTrack?.roundTypes && !selectedRoundType)}
        className="w-full bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-400 hover:to-purple-500 disabled:from-gray-700 disabled:to-gray-800 disabled:text-gray-500 text-white font-bold py-3 px-4 rounded-lg shadow-lg transform transition-all active:scale-95"
      >
        Start Interview
      </button>
    </div>
  );
}
