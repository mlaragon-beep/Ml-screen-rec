import { useEffect, useMemo, useRef, useState } from 'react';
import { Bookmark, Download, Film, Search, Trash2 } from 'lucide-react';
import { RecordedClip } from '../types/recorder';
import { formatBytes, formatDuration } from '../utils/compressionEngine';

interface ClipVaultProps {
  clips: RecordedClip[];
  onDeleteClip: (id: string) => void;
  onUpdateClipMeta: (id: string, patch: Partial<Pick<RecordedClip, 'title' | 'hero'>>) => void;
  onGoToRecorder: () => void;
}

type VaultFilter = 'all' | 'with-mic' | 'highlights';

export function ClipVault({
  clips,
  onDeleteClip,
  onUpdateClipMeta,
  onGoToRecorder,
}: ClipVaultProps) {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<VaultFilter>('all');
  const [selectedId, setSelectedId] = useState<string | null>(clips[0]?.id ?? null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const playerRef = useRef<HTMLVideoElement | null>(null);

  const filteredClips = useMemo(() => {
    const q = search.trim().toLowerCase();
    return clips.filter((clip) => {
      if (filter === 'with-mic' && !clip.hasMicAudio) return false;
      if (filter === 'highlights' && clip.highlights.length === 0) return false;
      if (!q) return true;
      return (
        clip.title.toLowerCase().includes(q) ||
        clip.hero.toLowerCase().includes(q)
      );
    });
  }, [clips, filter, search]);

  const activeClip = useMemo(() => {
    return (
      filteredClips.find((c) => c.id === selectedId) ??
      filteredClips[0] ??
      null
    );
  }, [filteredClips, selectedId]);

  const [objectUrl, setObjectUrl] = useState<string>('');

  useEffect(() => {
    if (!activeClip) {
      setObjectUrl('');
      return;
    }
    const url = URL.createObjectURL(activeClip.blob);
    setObjectUrl(url);
    return () => {
      URL.revokeObjectURL(url);
    };
  }, [activeClip]);

  const jumpToHighlight = (timestampSec: number) => {
    if (!playerRef.current) return;
    // Jump 2.5s before the stamped highlight so the play build-up is visible
    playerRef.current.currentTime = Math.max(0, timestampSec - 2.5);
    playerRef.current.play().catch(() => undefined);
  };

  const handleDownload = (clip: RecordedClip) => {
    const url = URL.createObjectURL(clip.blob);
    const ext = clip.mimeType.includes('mp4') ? 'mp4' : 'webm';
    const safeTitle = clip.title.replace(/[^a-z0-9_-]+/gi, '_').toLowerCase() || 'mlbb_match';
    const a = document.createElement('a');
    a.href = url;
    a.download = `${safeTitle}.${ext}`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  };

  if (clips.length === 0) {
    return (
      <section className="rounded-2xl border border-slate-800/90 bg-[#121722] p-10 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl border border-slate-800 bg-[#0B0E14] text-slate-400">
          <Film className="h-5 w-5" />
        </div>
        <h2 className="mt-4 font-display text-lg font-semibold text-slate-100">
          No Match Clips Recorded Yet
        </h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-slate-400 leading-relaxed">
          Your recorded Mobile Legends matches and highlight markers are stored privately in your browser&apos;s local vault for instant review and download.
        </p>
        <button
          type="button"
          onClick={onGoToRecorder}
          className="mt-6 min-h-[44px] inline-flex items-center justify-center rounded-xl bg-amber-500 hover:bg-amber-400 px-5 py-2.5 text-sm font-semibold text-slate-950 transition-colors"
        >
          Open Capture Studio
        </button>
      </section>
    );
  }

  return (
    <div className="space-y-6">
      {/* Search & Filter Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="relative flex-1 min-w-[240px] max-w-md">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search matches or heroes..."
            className="w-full min-h-[42px] rounded-xl border border-slate-800 bg-[#121722] pl-10 pr-4 text-sm text-slate-100 placeholder:text-slate-500 focus:border-amber-500 focus:outline-none"
          />
        </div>

        <div className="flex items-center gap-1 rounded-xl border border-slate-800 bg-[#121722] p-1">
          {(
            [
              { id: 'all', label: 'All Clips' },
              { id: 'with-mic', label: 'Internal + Mic' },
              { id: 'highlights', label: 'With Highlights' },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setFilter(tab.id)}
              className={`min-h-[36px] rounded-lg px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                filter === tab.id
                  ? 'bg-amber-500 text-slate-950 font-semibold'
                  : 'text-slate-400 hover:text-slate-100'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: Match List */}
        <div className="lg:col-span-5 rounded-2xl border border-slate-800/90 bg-[#121722] divide-y divide-slate-800/80 overflow-hidden">
          {filteredClips.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-400">
              No clips match your current filter.
            </div>
          ) : (
            filteredClips.map((clip) => {
              const selected = activeClip?.id === clip.id;
              return (
                <button
                  key={clip.id}
                  type="button"
                  onClick={() => {
                    setSelectedId(clip.id);
                    setConfirmDeleteId(null);
                  }}
                  className={`w-full text-left px-5 py-4 transition-colors flex items-start justify-between gap-3 ${
                    selected ? 'bg-amber-500/[0.08]' : 'hover:bg-slate-800/40'
                  }`}
                >
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-slate-100 truncate">
                      {clip.title}
                    </div>
                    <div className="mt-1 text-xs text-slate-400 truncate">
                      {clip.hero} · {formatDuration(clip.durationSec)} · {formatBytes(clip.sizeBytes)}
                    </div>
                    <div className="mt-1 font-mono text-[11px] text-slate-500 tabular-nums">
                      {clip.width}x{clip.height} · {clip.avgFps} fps · {clip.videoBitrateMbps} Mbps
                      {clip.hasInternalAudio ? ' · Internal' : ''}
                      {clip.hasMicAudio ? ' + Mic' : ''}
                    </div>
                  </div>
                  {clip.highlights.length > 0 && (
                    <span className="font-mono text-xs text-amber-400 whitespace-nowrap shrink-0 tabular-nums">
                      {clip.highlights.length} play{clip.highlights.length > 1 ? 's' : ''}
                    </span>
                  )}
                </button>
              );
            })
          )}
        </div>

        {/* Right: Active Clip Player & Metadata Editor */}
        {activeClip && (
          <div className="lg:col-span-7 rounded-2xl border border-slate-800/90 bg-[#121722] overflow-hidden">
            <div className="aspect-video w-full bg-[#070A0F]">
              {objectUrl && (
                <video
                  ref={playerRef}
                  src={objectUrl}
                  controls
                  playsInline
                  className="h-full w-full object-contain"
                />
              )}
            </div>

            <div className="p-5 space-y-5">
              {/* Editable Match Info & Export */}
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 flex-1 min-w-[240px]">
                  <div>
                    <label
                      htmlFor="vault-title"
                      className="block text-xs text-slate-400 mb-1"
                    >
                      Match Title
                    </label>
                    <input
                      id="vault-title"
                      type="text"
                      value={activeClip.title}
                      onChange={(e) =>
                        onUpdateClipMeta(activeClip.id, { title: e.target.value })
                      }
                      className="w-full min-h-[40px] rounded-lg border border-slate-800 bg-[#0B0E14] px-3 text-sm text-slate-100 focus:border-amber-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="vault-hero"
                      className="block text-xs text-slate-400 mb-1"
                    >
                      Hero
                    </label>
                    <input
                      id="vault-hero"
                      type="text"
                      value={activeClip.hero}
                      onChange={(e) =>
                        onUpdateClipMeta(activeClip.id, { hero: e.target.value })
                      }
                      className="w-full min-h-[40px] rounded-lg border border-slate-800 bg-[#0B0E14] px-3 text-sm text-slate-100 focus:border-amber-500 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-5">
                  <button
                    type="button"
                    onClick={() => handleDownload(activeClip)}
                    className="min-h-[42px] inline-flex items-center gap-2 rounded-xl bg-amber-500 hover:bg-amber-400 px-4 py-2 text-sm font-semibold text-slate-950 transition-colors whitespace-nowrap"
                  >
                    <Download className="h-4 w-4" />
                    Download
                  </button>

                  {confirmDeleteId === activeClip.id ? (
                    <button
                      type="button"
                      onClick={() => {
                        onDeleteClip(activeClip.id);
                        setConfirmDeleteId(null);
                      }}
                      className="min-h-[42px] rounded-xl bg-red-600 hover:bg-red-500 px-3.5 py-2 text-xs font-semibold text-white transition-colors whitespace-nowrap"
                    >
                      Confirm Delete
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirmDeleteId(activeClip.id)}
                      title="Delete clip"
                      className="min-h-[42px] min-w-[42px] inline-flex items-center justify-center rounded-xl border border-slate-800 bg-[#0B0E14] text-slate-400 hover:text-red-400 transition-colors"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>

              {/* Technical Metadata Row */}
              <div className="border-t border-slate-800/80 pt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-slate-400 font-mono tabular-nums">
                <span>
                  {activeClip.width}x{activeClip.height}
                </span>
                <span>{activeClip.avgFps} fps avg</span>
                <span>{activeClip.videoBitrateMbps} Mbps</span>
                <span>{formatBytes(activeClip.sizeBytes)}</span>
                <span>
                  Audio:{' '}
                  {[
                    activeClip.hasInternalAudio ? 'Internal Stereo' : null,
                    activeClip.hasMicAudio ? 'Microphone' : null,
                  ]
                    .filter(Boolean)
                    .join(' + ') || 'Video Only'}
                </span>
              </div>

              {/* Highlight Jump Chips */}
              <div className="border-t border-slate-800/80 pt-4">
                <div className="flex items-center gap-2 text-xs font-semibold text-slate-300 mb-2.5">
                  <Bookmark className="h-3.5 w-3.5 text-amber-400" />
                  <span>Stamped Match Highlights</span>
                </div>

                {activeClip.highlights.length === 0 ? (
                  <p className="text-xs text-slate-500">
                    No highlight stamps were marked during this recording.
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {activeClip.highlights.map((hl) => (
                      <button
                        key={hl.id}
                        type="button"
                        onClick={() => jumpToHighlight(hl.timestampSec)}
                        className="min-h-[38px] inline-flex items-center gap-2 rounded-lg border border-slate-700 bg-[#0B0E14] hover:border-amber-500/60 hover:text-amber-300 px-3 py-1.5 text-xs font-medium text-slate-200 transition-colors tabular-nums"
                      >
                        <span>{hl.label}</span>
                        <span className="font-mono text-slate-400">
                          {formatDuration(hl.timestampSec)}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
