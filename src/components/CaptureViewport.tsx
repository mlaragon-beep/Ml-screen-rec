import { RefObject, useState } from 'react';
import {
  Bookmark,
  Monitor,
  Pause,
  Play,
  Radio,
  Square,
  Unplug,
  Volume2,
  VolumeX,
  Mic,
  MicOff,
  Grid,
} from 'lucide-react';
import {
  AudioMixerConfig,
  CaptureSourceMode,
  CompressionProfile,
  HighlightKind,
  HighlightMarker,
  LivePerformanceStats,
  RecordingStatus,
} from '../types/recorder';
import { formatBytes, formatDuration } from '../utils/compressionEngine';

interface CaptureViewportProps {
  videoRef: RefObject<HTMLVideoElement | null>;
  status: RecordingStatus;
  sourceMode: CaptureSourceMode;
  hasActiveSource: boolean;
  hasInternalAudioTrack: boolean;
  hasMicTrack: boolean;
  profile: CompressionProfile;
  resolvedMimeType: string;
  audioConfig: AudioMixerConfig;
  stats: LivePerformanceStats;
  highlights: HighlightMarker[];
  matchTitle: string;
  heroName: string;
  errorMessage: string | null;
  onClearError: () => void;
  onMatchTitleChange: (val: string) => void;
  onHeroNameChange: (val: string) => void;
  onConnectSource: (mode: CaptureSourceMode) => void;
  onDisconnectSource: () => void;
  onStartRecording: (mode?: CaptureSourceMode) => void;
  onStopRecording: () => void;
  onTogglePause: () => void;
  onAddHighlight: (kind: HighlightKind) => void;
  onToggleInternalAudio: () => void;
  onToggleMicAudio: () => void;
}

const HIGHLIGHT_KINDS: HighlightKind[] = ['Savage', 'Maniac', 'Lord Steal', 'Outplay', 'Teamfight'];

export function CaptureViewport({
  videoRef,
  status,
  sourceMode,
  hasActiveSource,
  hasInternalAudioTrack,
  hasMicTrack,
  profile,
  resolvedMimeType,
  audioConfig,
  stats,
  highlights,
  matchTitle,
  heroName,
  errorMessage,
  onClearError,
  onMatchTitleChange,
  onHeroNameChange,
  onConnectSource,
  onDisconnectSource,
  onStartRecording,
  onStopRecording,
  onTogglePause,
  onAddHighlight,
  onToggleInternalAudio,
  onToggleMicAudio,
}: CaptureViewportProps) {
  const [showHudGuides, setShowHudGuides] = useState(false);
  const isRecording = status === 'recording';
  const isPaused = status === 'paused';
  const isActiveRec = isRecording || isPaused;

  const shortCodec = resolvedMimeType.includes('h264') || resolvedMimeType.includes('avc1')
    ? 'H.264'
    : resolvedMimeType.includes('vp9')
    ? 'VP9'
    : resolvedMimeType.includes('av01') || resolvedMimeType.includes('av1')
    ? 'AV1'
    : 'VP8';

  return (
    <section className="rounded-2xl border border-slate-800/90 bg-[#121722] overflow-hidden">
      {/* Compact studio toolbar above viewfinder */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800/80 px-4 py-3 sm:px-5">
        <div className="flex items-center gap-3 min-w-0">
          <span
            className={`inline-block h-2.5 w-2.5 rounded-full shrink-0 ${
              isRecording
                ? 'bg-red-500'
                : isPaused
                ? 'bg-amber-500'
                : hasActiveSource
                ? 'bg-emerald-500'
                : 'bg-slate-600'
            }`}
            aria-hidden="true"
          />
          <span className="text-sm font-semibold text-slate-100 whitespace-nowrap">
            {isRecording
              ? 'Recording Live'
              : isPaused
              ? 'Recording Paused'
              : hasActiveSource
              ? sourceMode === 'practice'
                ? 'Practice Signal Ready'
                : 'Screen Source Ready'
              : 'Capture Viewfinder'}
          </span>
          <span className="hidden sm:inline text-xs text-slate-400 truncate">
            {profile.resolution === 'native' ? 'Native' : profile.resolution} · {profile.fps} fps · {shortCodec} · {profile.videoBitrateMbps} Mbps
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowHudGuides((v) => !v)}
            className={`min-h-[40px] inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
              showHudGuides
                ? 'border-amber-500/60 bg-amber-500/10 text-amber-300'
                : 'border-slate-700/80 bg-slate-900/60 text-slate-300 hover:text-white'
            }`}
          >
            <Grid className="h-3.5 w-3.5" />
            HUD Guides
          </button>

          {hasActiveSource && !isActiveRec && (
            <button
              type="button"
              onClick={onDisconnectSource}
              className="min-h-[40px] inline-flex items-center gap-1.5 rounded-lg border border-slate-700/80 bg-slate-900/60 px-3 py-1.5 text-xs font-medium text-slate-300 hover:text-white transition-colors whitespace-nowrap shrink-0"
            >
              <Unplug className="h-3.5 w-3.5" />
              Disconnect
            </button>
          )}
        </div>
      </div>

      {/* Inline error notice if capture permission was denied or unsupported */}
      {errorMessage && (
        <div
          role="alert"
          className="flex items-start justify-between gap-4 border-b border-red-900/60 bg-red-950/40 px-4 py-3 text-sm text-red-200 sm:px-5"
        >
          <p className="leading-relaxed">{errorMessage}</p>
          <button
            type="button"
            onClick={onClearError}
            className="text-xs font-semibold text-red-300 hover:text-white underline whitespace-nowrap shrink-0 py-1"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Main 16:9 Viewfinder Canvas */}
      <div className="relative aspect-video w-full bg-[#070A0F]">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className={`h-full w-full object-contain transition-opacity duration-200 ${
            hasActiveSource ? 'opacity-100' : 'opacity-0 pointer-events-none'
          }`}
        />

        {/* Optional MLBB Safe-Zone HUD Overlay (preview only, never drawn onto video track) */}
        {showHudGuides && (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 p-3 sm:p-5 flex flex-col justify-between"
          >
            <div className="flex items-start justify-between">
              <div className="h-20 w-20 sm:h-28 sm:w-28 rounded-lg border border-dashed border-amber-400/60 bg-amber-500/5 flex items-end p-1.5">
                <span className="text-[10px] font-mono text-amber-300">Minimap</span>
              </div>
              <div className="h-9 w-40 sm:w-56 rounded-lg border border-dashed border-slate-400/50 bg-slate-900/30 flex items-center justify-center">
                <span className="text-[10px] font-mono text-slate-300">KDA · Gold · Timer</span>
              </div>
              <div className="h-10 w-24 rounded-lg border border-dashed border-slate-400/40 bg-slate-900/20 flex items-center justify-center">
                <span className="text-[10px] font-mono text-slate-300">Settings</span>
              </div>
            </div>

            <div className="flex items-end justify-between">
              <div className="h-24 w-24 sm:h-32 sm:w-32 rounded-full border border-dashed border-emerald-400/50 bg-emerald-500/5 flex items-center justify-center">
                <span className="text-[10px] font-mono text-emerald-300">Joystick</span>
              </div>
              <div className="h-28 w-36 sm:h-36 sm:w-48 rounded-2xl border border-dashed border-amber-400/50 bg-amber-500/5 flex items-center justify-center">
                <span className="text-[10px] font-mono text-amber-300">Skill Wheel</span>
              </div>
            </div>
          </div>
        )}

        {/* Active Recording Timer Overlay (top-right corner with scrim) */}
        {isActiveRec && (
          <div className="absolute top-3 right-3 rounded-lg bg-black/75 backdrop-blur-sm border border-white/10 px-3 py-1.5 flex items-center gap-2.5">
            <span
              className={`h-2 w-2 rounded-full ${
                isRecording ? 'bg-red-500' : 'bg-amber-400'
              }`}
              aria-hidden="true"
            />
            <span className="font-mono text-sm font-semibold text-white tabular-nums">
              {formatDuration(stats.elapsedSec)}
            </span>
          </div>
        )}

        {/* Empty / Ready Initiation Overlay when no capture source is active */}
        {!hasActiveSource && (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center bg-gradient-to-b from-[#0E131E] to-[#080B11]">
            <h1 className="font-display text-xl sm:text-2xl font-bold text-slate-50 max-w-lg text-balance">
              Zero-Lag Mobile Legends Capture
            </h1>
            <p className="mt-2 max-w-md text-sm text-slate-400 leading-relaxed">
              Select your Mobile Legends window, Android browser screen, or USB-C mirrored display with stereo internal audio and mic commentary.
            </p>

            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => onConnectSource('screen')}
                className="min-h-[44px] inline-flex items-center gap-2 rounded-xl bg-amber-500 hover:bg-amber-400 px-5 py-2.5 text-sm font-semibold text-slate-950 transition-colors whitespace-nowrap"
              >
                <Monitor className="h-4 w-4" />
                Select Screen &amp; Internal Audio
              </button>

              <button
                type="button"
                onClick={() => onConnectSource('practice')}
                className="min-h-[44px] inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-900/80 hover:bg-slate-800 px-4 py-2.5 text-sm font-medium text-slate-200 transition-colors whitespace-nowrap"
              >
                <Radio className="h-4 w-4 text-emerald-400" />
                Run Practice Signal
              </button>
            </div>

            <p className="mt-4 text-xs text-slate-500 max-w-md">
              Tip: Enable &ldquo;Also share system/tab audio&rdquo; in the browser prompt to capture internal game effects cleanly.
            </p>
          </div>
        )}
      </div>

      {/* Live Performance & Frame Pacing Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-5 border-t border-slate-800/80 divide-y sm:divide-y-0 sm:divide-x divide-slate-800/80 bg-[#0F141E]">
        <div className="px-4 py-3">
          <div className="text-xs text-slate-400">Frame Rate</div>
          <div className="mt-0.5 font-mono text-base font-semibold text-slate-100 tabular-nums">
            {hasActiveSource ? `${stats.actualFps || profile.fps} fps` : `Target ${profile.fps} fps`}
          </div>
        </div>
        <div className="px-4 py-3">
          <div className="text-xs text-slate-400">Frame Pacing</div>
          <div className="mt-0.5 font-mono text-base font-semibold text-slate-100 tabular-nums">
            {hasActiveSource && stats.framePacingMs > 0 ? `${stats.framePacingMs} ms` : '—'}
          </div>
        </div>
        <div className="px-4 py-3">
          <div className="text-xs text-slate-400">Main-Thread Jitter</div>
          <div className="mt-0.5 font-mono text-base font-semibold text-emerald-400 tabular-nums">
            {`${stats.mainThreadJitterMs.toFixed(1)} ms`}
          </div>
        </div>
        <div className="px-4 py-3">
          <div className="text-xs text-slate-400">Live Bitrate</div>
          <div className="mt-0.5 font-mono text-base font-semibold text-slate-100 tabular-nums">
            {isActiveRec ? `${stats.estBitrateMbps.toFixed(1)} Mbps` : `${profile.videoBitrateMbps} Mbps`}
          </div>
        </div>
        <div className="col-span-2 sm:col-span-1 px-4 py-3">
          <div className="text-xs text-slate-400">Buffer Size</div>
          <div className="mt-0.5 font-mono text-base font-semibold text-slate-100 tabular-nums">
            {isActiveRec ? formatBytes(stats.encodedBytes) : '0 B'}
          </div>
        </div>
      </div>

      {/* Transport Bar + Match Metadata + Quick Audio Toggles */}
      <div className="border-t border-slate-800/80 p-4 sm:p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Primary transport actions */}
          <div className="flex flex-wrap items-center gap-2.5">
            {!isActiveRec ? (
              <button
                type="button"
                disabled={status === 'preparing' || status === 'saving'}
                onClick={() => onStartRecording()}
                className="min-h-[44px] inline-flex items-center gap-2 rounded-xl bg-amber-500 hover:bg-amber-400 px-5 py-2.5 text-sm font-semibold text-slate-950 transition-colors whitespace-nowrap disabled:opacity-60"
              >
                <Play className="h-4 w-4 fill-current" />
                {hasActiveSource ? 'Start Recording' : 'Select Screen & Record'}
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={onTogglePause}
                  className="min-h-[44px] inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-800/80 hover:bg-slate-700 px-4 py-2.5 text-sm font-medium text-slate-100 transition-colors whitespace-nowrap"
                >
                  {isPaused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
                  {isPaused ? 'Resume' : 'Pause'}
                </button>
                <button
                  type="button"
                  onClick={onStopRecording}
                  className="min-h-[44px] inline-flex items-center gap-2 rounded-xl bg-red-600 hover:bg-red-500 px-5 py-2.5 text-sm font-semibold text-white transition-colors whitespace-nowrap"
                >
                  <Square className="h-3.5 w-3.5 fill-current" />
                  Stop &amp; Save
                </button>
              </>
            )}
          </div>

          {/* Instant live audio bus mute buttons */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={onToggleInternalAudio}
              className={`min-h-[44px] inline-flex items-center gap-2 rounded-xl border px-3.5 py-2 text-xs font-semibold transition-colors whitespace-nowrap ${
                audioConfig.internalEnabled
                  ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
                  : 'border-slate-700 bg-slate-900 text-slate-400 hover:text-slate-200'
              }`}
            >
              {audioConfig.internalEnabled ? (
                <Volume2 className="h-4 w-4" />
              ) : (
                <VolumeX className="h-4 w-4" />
              )}
              Internal Audio {audioConfig.internalEnabled ? 'On' : 'Muted'}
              {hasActiveSource && !hasInternalAudioTrack && audioConfig.internalEnabled && (
                <span className="text-amber-400">· No Track</span>
              )}
            </button>

            <button
              type="button"
              onClick={onToggleMicAudio}
              className={`min-h-[44px] inline-flex items-center gap-2 rounded-xl border px-3.5 py-2 text-xs font-semibold transition-colors whitespace-nowrap ${
                audioConfig.micEnabled
                  ? 'border-amber-500/40 bg-amber-500/10 text-amber-300'
                  : 'border-slate-700 bg-slate-900 text-slate-400 hover:text-slate-200'
              }`}
            >
              {audioConfig.micEnabled ? (
                <Mic className="h-4 w-4" />
              ) : (
                <MicOff className="h-4 w-4" />
              )}
              Mic {audioConfig.micEnabled ? (hasMicTrack ? 'Live' : 'Connecting') : 'Off'}
            </button>
          </div>
        </div>

        {/* Match Title + Hero Metadata */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
          <div>
            <label htmlFor="match-title" className="block text-xs font-medium text-slate-400 mb-1.5">
              Match Label
            </label>
            <input
              id="match-title"
              type="text"
              value={matchTitle}
              onChange={(e) => onMatchTitleChange(e.target.value)}
              placeholder="e.g. Mythic Glory Ranked #4"
              className="w-full min-h-[42px] rounded-xl border border-slate-800 bg-[#0B0E14] px-3.5 py-2 text-sm text-slate-100 placeholder:text-slate-600 focus:border-amber-500 focus:outline-none"
            />
          </div>
          <div>
            <label htmlFor="hero-name" className="block text-xs font-medium text-slate-400 mb-1.5">
              Hero Played
            </label>
            <input
              id="hero-name"
              type="text"
              value={heroName}
              onChange={(e) => onHeroNameChange(e.target.value)}
              placeholder="e.g. Fanny, Ling, Tigreal"
              className="w-full min-h-[42px] rounded-xl border border-slate-800 bg-[#0B0E14] px-3.5 py-2 text-sm text-slate-100 placeholder:text-slate-600 focus:border-amber-500 focus:outline-none"
            />
          </div>
        </div>

        {/* One-Tap Highlight Timestamp Markers */}
        <div className="pt-2 border-t border-slate-800/70 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <Bookmark className="h-3.5 w-3.5 text-amber-400" />
            <span>
              {isActiveRec
                ? 'Stamp clutch plays during match:'
                : 'Highlight stamps activate during recording'}
            </span>
            {highlights.length > 0 && (
              <span className="font-mono text-amber-300 tabular-nums">
                {highlights.length} marked
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {HIGHLIGHT_KINDS.map((kind) => (
              <button
                key={kind}
                type="button"
                disabled={!isActiveRec}
                onClick={() => onAddHighlight(kind)}
                className="min-h-[38px] rounded-lg border border-slate-700/80 bg-slate-900/70 hover:border-amber-500/60 hover:text-amber-300 px-3 py-1.5 text-xs font-medium text-slate-300 transition-colors disabled:opacity-40 disabled:pointer-events-none whitespace-nowrap"
              >
                {kind}
              </button>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
