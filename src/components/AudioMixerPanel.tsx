import { RefreshCw, Mic, MicOff, Volume2, VolumeX } from 'lucide-react';
import { AudioMixerConfig, LivePerformanceStats } from '../types/recorder';

interface AudioMixerPanelProps {
  config: AudioMixerConfig;
  stats: LivePerformanceStats;
  hasActiveSource: boolean;
  hasInternalAudioTrack: boolean;
  hasMicTrack: boolean;
  micDevices: MediaDeviceInfo[];
  onChange: (patch: Partial<AudioMixerConfig>) => void;
  onRefreshDevices: () => void;
}

function SegmentedMeter({ level, muted }: { level: number; muted: boolean }) {
  const segments = 18;
  const activeCount = muted ? 0 : Math.round(level * segments);

  return (
    <div
      className="grid grid-cols-18 gap-1 py-1"
      role="meter"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={muted ? 0 : Math.round(level * 100)}
    >
      {Array.from({ length: segments }).map((_, idx) => {
        const lit = idx < activeCount;
        let color = 'bg-slate-800';
        if (lit) {
          if (idx >= 15) color = 'bg-red-500';
          else if (idx >= 11) color = 'bg-amber-400';
          else color = 'bg-emerald-500';
        }
        return (
          <div
            key={idx}
            className={`h-2.5 rounded-[2px] transition-colors duration-75 ${color}`}
          />
        );
      })}
    </div>
  );
}

export function AudioMixerPanel({
  config,
  stats,
  hasActiveSource,
  hasInternalAudioTrack,
  hasMicTrack,
  micDevices,
  onChange,
  onRefreshDevices,
}: AudioMixerPanelProps) {
  return (
    <section className="rounded-2xl border border-slate-800/90 bg-[#121722]">
      <div className="flex items-center justify-between border-b border-slate-800/80 px-5 py-4">
        <div>
          <h2 className="font-display text-base font-semibold text-slate-100">
            Dual-Track Audio Mixer
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Stereo internal game audio + live microphone bus
          </p>
        </div>
        {stats.duckingActive && (
          <span className="text-xs font-medium text-amber-400 whitespace-nowrap">
            Auto-Ducking Active
          </span>
        )}
      </div>

      {/* Bus 1: Internal Game Audio */}
      <div className="p-5 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-sm font-semibold text-slate-100">
              Internal Game Audio
            </div>
            <div className="text-xs text-slate-400">
              {hasActiveSource
                ? hasInternalAudioTrack
                  ? 'Raw 48 kHz stereo signal active'
                  : 'No system audio track shared in prompt'
                : 'Captures MLBB SFX, voice lines & pings'}
            </div>
          </div>

          <button
            type="button"
            onClick={() => onChange({ internalEnabled: !config.internalEnabled })}
            className={`min-h-[40px] inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
              config.internalEnabled
                ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
                : 'border-slate-700 bg-slate-900 text-slate-400 hover:text-slate-200'
            }`}
          >
            {config.internalEnabled ? (
              <Volume2 className="h-3.5 w-3.5" />
            ) : (
              <VolumeX className="h-3.5 w-3.5" />
            )}
            {config.internalEnabled ? 'Enabled' : 'Muted'}
          </button>
        </div>

        <SegmentedMeter level={stats.internalLevel} muted={!config.internalEnabled} />

        <div className="flex items-center gap-3">
          <label htmlFor="internal-gain" className="text-xs text-slate-400 w-16 shrink-0">
            Game Gain
          </label>
          <input
            id="internal-gain"
            type="range"
            min={0}
            max={150}
            step={5}
            value={Math.round(config.internalGain * 100)}
            onChange={(e) => onChange({ internalGain: Number(e.target.value) / 100 })}
            className="studio-slider flex-1"
          />
          <span className="font-mono text-xs text-slate-200 tabular-nums w-11 text-right">
            {Math.round(config.internalGain * 100)}%
          </span>
        </div>
      </div>

      {/* Bus 2: Microphone */}
      <div className="border-t border-slate-800/80 p-5 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-sm font-semibold text-slate-100">
              Microphone Commentary
            </div>
            <div className="text-xs text-slate-400">
              {config.micEnabled
                ? hasMicTrack
                  ? 'Live voice input connected'
                  : 'Waiting for mic permission...'
                : 'Off (game audio only)'}
            </div>
          </div>

          <button
            type="button"
            onClick={() => onChange({ micEnabled: !config.micEnabled })}
            className={`min-h-[40px] inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
              config.micEnabled
                ? 'border-amber-500/40 bg-amber-500/10 text-amber-300'
                : 'border-slate-700 bg-slate-900 text-slate-400 hover:text-slate-200'
            }`}
          >
            {config.micEnabled ? (
              <Mic className="h-3.5 w-3.5" />
            ) : (
              <MicOff className="h-3.5 w-3.5" />
            )}
            {config.micEnabled ? 'Active' : 'Enable Mic'}
          </button>
        </div>

        <SegmentedMeter level={stats.micLevel} muted={!config.micEnabled} />

        <div className="flex items-center gap-3">
          <label htmlFor="mic-gain" className="text-xs text-slate-400 w-16 shrink-0">
            Mic Gain
          </label>
          <input
            id="mic-gain"
            type="range"
            min={0}
            max={150}
            step={5}
            value={Math.round(config.micGain * 100)}
            onChange={(e) => onChange({ micGain: Number(e.target.value) / 100 })}
            className="studio-slider flex-1"
          />
          <span className="font-mono text-xs text-slate-200 tabular-nums w-11 text-right">
            {Math.round(config.micGain * 100)}%
          </span>
        </div>

        {/* Mic input device selector */}
        <div className="flex items-center gap-2 pt-1">
          <select
            aria-label="Microphone device"
            value={config.micDeviceId}
            onChange={(e) => onChange({ micDeviceId: e.target.value })}
            className="min-h-[40px] flex-1 min-w-0 rounded-lg border border-slate-800 bg-[#0B0E14] px-3 py-1.5 text-xs text-slate-200 focus:border-amber-500 focus:outline-none truncate"
          >
            <option value="">Default Microphone</option>
            {micDevices.map((d, idx) => (
              <option key={d.deviceId || idx} value={d.deviceId}>
                {d.label || `Microphone ${idx + 1}`}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={onRefreshDevices}
            title="Refresh audio devices"
            className="min-h-[40px] min-w-[40px] inline-flex items-center justify-center rounded-lg border border-slate-800 bg-[#0B0E14] text-slate-400 hover:text-slate-100 transition-colors shrink-0"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Audio Routing & DSP Options */}
      <div className="border-t border-slate-800/80 p-5 space-y-3">
        <div className="text-xs font-semibold text-slate-300">Signal Conditioning</div>

        <label className="flex items-start justify-between gap-3 cursor-pointer py-1">
          <div>
            <div className="text-sm font-medium text-slate-200">Auto-Duck Game Audio</div>
            <div className="text-xs text-slate-400">
              Lowers game SFX while speaking so voice callouts stay clear
            </div>
          </div>
          <input
            type="checkbox"
            checked={config.autoDucking}
            onChange={(e) => onChange({ autoDucking: e.target.checked })}
            className="mt-1 h-4 w-4 rounded border-slate-700 bg-slate-900 accent-amber-500"
          />
        </label>

        <label className="flex items-start justify-between gap-3 cursor-pointer py-1">
          <div>
            <div className="text-sm font-medium text-slate-200">Teamfight Peak Limiter</div>
            <div className="text-xs text-slate-400">
              Prevents audio clipping during multi-kill &amp; Lord bursts
            </div>
          </div>
          <input
            type="checkbox"
            checked={config.internalLimiter}
            onChange={(e) => onChange({ internalLimiter: e.target.checked })}
            className="mt-1 h-4 w-4 rounded border-slate-700 bg-slate-900 accent-amber-500"
          />
        </label>

        <label className="flex items-start justify-between gap-3 cursor-pointer py-1">
          <div>
            <div className="text-sm font-medium text-slate-200">Mic Noise Suppression &amp; AEC</div>
            <div className="text-xs text-slate-400">
              Filters thumb taps and speaker bleed on mic only
            </div>
          </div>
          <input
            type="checkbox"
            checked={config.micNoiseSuppression}
            onChange={(e) =>
              onChange({
                micNoiseSuppression: e.target.checked,
                micEchoCancellation: e.target.checked,
              })
            }
            className="mt-1 h-4 w-4 rounded border-slate-700 bg-slate-900 accent-amber-500"
          />
        </label>

        <label className="flex items-start justify-between gap-3 cursor-pointer py-1">
          <div>
            <div className="text-sm font-medium text-slate-200">Headphone Audio Monitor</div>
            <div className="text-xs text-slate-400">
              Listen to internal audio output locally (keep off on speakers)
            </div>
          </div>
          <input
            type="checkbox"
            checked={config.monitorLocally}
            onChange={(e) => onChange({ monitorLocally: e.target.checked })}
            className="mt-1 h-4 w-4 rounded border-slate-700 bg-slate-900 accent-amber-500"
          />
        </label>
      </div>
    </section>
  );
}
