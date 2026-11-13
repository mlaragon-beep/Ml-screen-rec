import { useState } from 'react';
import { ChevronDown, ChevronUp, Cpu, Check } from 'lucide-react';
import {
  CodecCapability,
  CompressionProfile,
  CompressionProfileId,
  PreferredCodec,
  ResolutionPreset,
} from '../types/recorder';
import {
  COMPRESSION_PROFILES,
  estimateSizePerMinuteMB,
} from '../utils/compressionEngine';

interface CompressionPanelProps {
  profile: CompressionProfile;
  isRecording: boolean;
  codecCapabilities: CodecCapability[];
  resolvedMimeType: string;
  onSelectPreset: (id: Exclude<CompressionProfileId, 'custom'>) => void;
  onUpdateCustom: (patch: Partial<CompressionProfile>) => void;
}

export function CompressionPanel({
  profile,
  isRecording,
  codecCapabilities,
  resolvedMimeType,
  onSelectPreset,
  onUpdateCustom,
}: CompressionPanelProps) {
  const [showAdvanced, setShowAdvanced] = useState(profile.id === 'custom');
  const presets = Object.values(COMPRESSION_PROFILES);
  const estMbPerMin = estimateSizePerMinuteMB(profile.videoBitrateMbps, profile.audioBitrateKbps);

  return (
    <section className="rounded-2xl border border-slate-800/90 bg-[#121722]">
      <div className="flex items-center justify-between border-b border-slate-800/80 px-5 py-4">
        <div>
          <h2 className="font-display text-base font-semibold text-slate-100">
            Low-Impact Compression
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Direct pass-through · ~{estMbPerMin.toFixed(0)} MB/min
          </p>
        </div>
        <span className="font-mono text-xs text-emerald-400 tabular-nums whitespace-nowrap">
          {profile.cpuImpact} CPU
        </span>
      </div>

      {/* Preset Selection List */}
      <div className="divide-y divide-slate-800/70">
        {presets.map((item) => {
          const selected = profile.id === item.id;
          return (
            <button
              key={item.id}
              type="button"
              disabled={isRecording}
              onClick={() => onSelectPreset(item.id as Exclude<CompressionProfileId, 'custom'>)}
              className={`w-full text-left px-5 py-3.5 transition-colors flex items-start justify-between gap-3 disabled:opacity-60 ${
                selected ? 'bg-amber-500/[0.07]' : 'hover:bg-slate-800/35'
              }`}
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span
                    className={`text-sm font-semibold ${
                      selected ? 'text-amber-300' : 'text-slate-100'
                    }`}
                  >
                    {item.name}
                  </span>
                  <span className="text-xs text-slate-500">· {item.targetAudience}</span>
                </div>
                <div className="mt-1 font-mono text-xs text-slate-400 tabular-nums">
                  {item.resolution} · {item.fps} fps · {item.videoBitrateMbps} Mbps ·{' '}
                  {item.preferredCodec.toUpperCase()}
                </div>
                <p className="mt-1 text-xs text-slate-400 leading-relaxed">{item.summary}</p>
              </div>
              <div
                className={`mt-0.5 h-5 w-5 rounded-full border flex items-center justify-center shrink-0 ${
                  selected
                    ? 'border-amber-500 bg-amber-500 text-slate-950'
                    : 'border-slate-700 bg-transparent'
                }`}
              >
                {selected && <Check className="h-3 w-3 stroke-[3]" />}
              </div>
            </button>
          );
        })}
      </div>

      {/* Custom Compression Tuning Drawer */}
      <div className="border-t border-slate-800/80">
        <button
          type="button"
          onClick={() => setShowAdvanced((v) => !v)}
          className="w-full min-h-[44px] flex items-center justify-between px-5 py-3 text-xs font-semibold text-slate-300 hover:text-white transition-colors"
        >
          <span>Custom Encoder Tuning &amp; Codec Probe</span>
          {showAdvanced ? (
            <ChevronUp className="h-4 w-4 text-slate-400" />
          ) : (
            <ChevronDown className="h-4 w-4 text-slate-400" />
          )}
        </button>

        {showAdvanced && (
          <div className="border-t border-slate-800/70 p-5 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="res-select" className="block text-xs text-slate-400 mb-1.5">
                  Resolution
                </label>
                <select
                  id="res-select"
                  disabled={isRecording}
                  value={profile.resolution}
                  onChange={(e) =>
                    onUpdateCustom({ resolution: e.target.value as ResolutionPreset })
                  }
                  className="w-full min-h-[40px] rounded-lg border border-slate-800 bg-[#0B0E14] px-3 text-xs text-slate-200 focus:border-amber-500 focus:outline-none disabled:opacity-60"
                >
                  <option value="540p">540p (Low RAM)</option>
                  <option value="720p">720p (Ranked Zero-Lag)</option>
                  <option value="1080p">1080p (Full HD)</option>
                  <option value="native">Native Display</option>
                </select>
              </div>

              <div>
                <label htmlFor="fps-select" className="block text-xs text-slate-400 mb-1.5">
                  Target Frame Rate
                </label>
                <select
                  id="fps-select"
                  disabled={isRecording}
                  value={profile.fps}
                  onChange={(e) =>
                    onUpdateCustom({ fps: Number(e.target.value) as 30 | 60 | 90 | 120 })
                  }
                  className="w-full min-h-[40px] rounded-lg border border-slate-800 bg-[#0B0E14] px-3 text-xs text-slate-200 focus:border-amber-500 focus:outline-none disabled:opacity-60"
                >
                  <option value={30}>30 fps (Battery Saver)</option>
                  <option value={60}>60 fps (MLBB High)</option>
                  <option value={90}>90 fps (Ultra Refresh)</option>
                  <option value={120}>120 fps (120Hz Displays)</option>
                </select>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between text-xs mb-1">
                <label htmlFor="bitrate-slider" className="text-slate-400">
                  Video Bitrate
                </label>
                <span className="font-mono text-slate-200 tabular-nums">
                  {profile.videoBitrateMbps.toFixed(1)} Mbps
                </span>
              </div>
              <input
                id="bitrate-slider"
                type="range"
                disabled={isRecording}
                min={1.5}
                max={20}
                step={0.5}
                value={profile.videoBitrateMbps}
                onChange={(e) => onUpdateCustom({ videoBitrateMbps: Number(e.target.value) })}
                className="studio-slider w-full disabled:opacity-60"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="codec-select" className="block text-xs text-slate-400 mb-1.5">
                  Preferred Codec
                </label>
                <select
                  id="codec-select"
                  disabled={isRecording}
                  value={profile.preferredCodec}
                  onChange={(e) =>
                    onUpdateCustom({ preferredCodec: e.target.value as PreferredCodec })
                  }
                  className="w-full min-h-[40px] rounded-lg border border-slate-800 bg-[#0B0E14] px-3 text-xs text-slate-200 focus:border-amber-500 focus:outline-none disabled:opacity-60"
                >
                  <option value="h264">H.264 (Hardware ASIC)</option>
                  <option value="vp8">VP8 (Low-CPU Fallback)</option>
                  <option value="vp9">VP9 (High Compression)</option>
                  <option value="av1">AV1 (Experimental)</option>
                </select>
              </div>

              <div>
                <label htmlFor="chunk-select" className="block text-xs text-slate-400 mb-1.5">
                  Buffer Flush Interval
                </label>
                <select
                  id="chunk-select"
                  disabled={isRecording}
                  value={profile.chunkIntervalMs}
                  onChange={(e) =>
                    onUpdateCustom({ chunkIntervalMs: Number(e.target.value) as 2000 | 3000 | 4000 })
                  }
                  className="w-full min-h-[40px] rounded-lg border border-slate-800 bg-[#0B0E14] px-3 text-xs text-slate-200 focus:border-amber-500 focus:outline-none disabled:opacity-60"
                >
                  <option value={4000}>4.0s (Fewest I/O Spikes)</option>
                  <option value={3000}>3.0s (Balanced)</option>
                  <option value={2000}>2.0s (Rapid Flush)</option>
                </select>
              </div>
            </div>

            {/* Live Device Hardware Codec Probe */}
            <div className="pt-3 border-t border-slate-800/70 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="inline-flex items-center gap-1.5 font-semibold text-slate-300">
                  <Cpu className="h-3.5 w-3.5 text-amber-400" />
                  Device Encoder Probe
                </span>
                <span className="font-mono text-[11px] text-slate-500 truncate max-w-[170px]">
                  {resolvedMimeType || 'video/webm'}
                </span>
              </div>

              <div className="divide-y divide-slate-800/60 text-xs">
                {codecCapabilities.map((cap) => (
                  <div key={cap.id} className="flex items-center justify-between py-2 gap-2">
                    <div className="min-w-0">
                      <span className="font-medium text-slate-200">{cap.label}</span>
                      <span className="ml-2 text-slate-500">· {cap.cpuImpact} CPU</span>
                    </div>
                    <span
                      className={`font-mono whitespace-nowrap ${
                        !cap.supported
                          ? 'text-slate-500'
                          : cap.hardwareAccelerated
                          ? 'text-emerald-400'
                          : 'text-slate-300'
                      }`}
                    >
                      {!cap.supported
                        ? 'Unsupported'
                        : cap.hardwareAccelerated
                        ? 'HW Ready'
                        : 'Supported'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
