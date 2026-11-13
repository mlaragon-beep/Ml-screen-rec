import { useCallback, useEffect, useState } from 'react';
import { BookOpen, Film, Sliders, Video } from 'lucide-react';
import { AudioMixerPanel } from './components/AudioMixerPanel';
import { CaptureViewport } from './components/CaptureViewport';
import { ClipVault } from './components/ClipVault';
import { CompressionPanel } from './components/CompressionPanel';
import { SetupGuide } from './components/SetupGuide';
import { TopBar } from './components/TopBar';
import { useStudioRecorder } from './hooks/useStudioRecorder';
import {
  ActiveTab,
  AudioMixerConfig,
  CompressionProfile,
  CompressionProfileId,
  RecordedClip,
} from './types/recorder';
import { deleteClip, getAllClips, updateClipMeta } from './utils/clipStorage';
import { COMPRESSION_PROFILES, formatBytes, formatDuration } from './utils/compressionEngine';

const DEFAULT_AUDIO_CONFIG: AudioMixerConfig = {
  internalEnabled: true,
  internalGain: 1.0,
  internalLimiter: true,
  micEnabled: false,
  micDeviceId: '',
  micGain: 1.0,
  micNoiseSuppression: true,
  micEchoCancellation: true,
  autoDucking: true,
  monitorLocally: false,
};

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('recorder');
  const [profile, setProfile] = useState<CompressionProfile>(COMPRESSION_PROFILES['zero-lag']);
  const [audioConfig, setAudioConfig] = useState<AudioMixerConfig>(DEFAULT_AUDIO_CONFIG);
  const [clips, setClips] = useState<RecordedClip[]>([]);
  const [lastSavedClip, setLastSavedClip] = useState<RecordedClip | null>(null);

  useEffect(() => {
    getAllClips()
      .then(setClips)
      .catch(() => setClips([]));
  }, []);

  const handleClipSaved = useCallback((clip: RecordedClip) => {
    setClips((prev) => [clip, ...prev]);
    setLastSavedClip(clip);
  }, []);

  const recorder = useStudioRecorder({
    profile,
    audioConfig,
    onClipSaved: handleClipSaved,
  });

  const isRecording = recorder.status === 'recording' || recorder.status === 'paused';

  const handleSelectPreset = (id: Exclude<CompressionProfileId, 'custom'>) => {
    setProfile(COMPRESSION_PROFILES[id]);
  };

  const handleUpdateCustomProfile = (patch: Partial<CompressionProfile>) => {
    setProfile((prev) => ({
      ...prev,
      ...patch,
      id: 'custom',
      name: 'Custom Profile',
      targetAudience: 'Manual encoder tuning',
      cpuImpact:
        (patch.preferredCodec ?? prev.preferredCodec) === 'vp9' ||
        (patch.preferredCodec ?? prev.preferredCodec) === 'av1'
          ? 'Moderate'
          : (patch.fps ?? prev.fps) > 60
          ? 'Low'
          : 'Minimal',
    }));
  };

  const handleAudioChange = (patch: Partial<AudioMixerConfig>) => {
    setAudioConfig((prev) => ({ ...prev, ...patch }));
  };

  const handleTopBarPrimaryAction = () => {
    if (isRecording) {
      recorder.stopRecording();
    } else {
      if (activeTab !== 'recorder') {
        setActiveTab('recorder');
      }
      recorder.startRecording();
    }
  };

  const handleDeleteClip = async (id: string) => {
    await deleteClip(id).catch(() => undefined);
    setClips((prev) => prev.filter((c) => c.id !== id));
    if (lastSavedClip?.id === id) {
      setLastSavedClip(null);
    }
  };

  const handleUpdateClipMeta = async (
    id: string,
    patch: Partial<Pick<RecordedClip, 'title' | 'hero'>>
  ) => {
    setClips((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)));
    await updateClipMeta(id, patch).catch(() => undefined);
  };

  return (
    <div className="min-h-screen bg-[#0B0E14] text-slate-100 flex flex-col">
      <TopBar
        activeTab={activeTab}
        onTabChange={setActiveTab}
        status={recorder.status}
        clipCount={clips.length}
        onPrimaryAction={handleTopBarPrimaryAction}
      />

      <main className="mx-auto w-full max-w-[1440px] flex-1 px-4 py-6 pb-24 sm:px-6 lg:px-8 md:pb-10 space-y-5">
        {/* Subtle confirmation banner after saving a match */}
        {lastSavedClip && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/[0.08] px-4 py-3 text-sm">
            <div className="text-emerald-200">
              Saved <span className="font-semibold text-white">{lastSavedClip.title}</span> ·{' '}
              <span className="font-mono text-xs tabular-nums">
                {formatDuration(lastSavedClip.durationSec)} · {formatBytes(lastSavedClip.sizeBytes)}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => {
                  setActiveTab('vault');
                  setLastSavedClip(null);
                }}
                className="text-xs font-semibold text-amber-400 hover:text-amber-300 underline whitespace-nowrap"
              >
                Open in Clip Vault
              </button>
              <button
                type="button"
                onClick={() => setLastSavedClip(null)}
                className="text-xs text-slate-400 hover:text-white whitespace-nowrap"
              >
                Dismiss
              </button>
            </div>
          </div>
        )}

        {activeTab === 'recorder' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            <div className="lg:col-span-8 space-y-6">
              <CaptureViewport
                videoRef={recorder.previewVideoRef}
                status={recorder.status}
                sourceMode={recorder.sourceMode}
                hasActiveSource={recorder.hasActiveSource}
                hasInternalAudioTrack={recorder.hasInternalAudioTrack}
                hasMicTrack={recorder.hasMicTrack}
                profile={profile}
                resolvedMimeType={recorder.resolvedMimeType}
                audioConfig={audioConfig}
                stats={recorder.stats}
                highlights={recorder.highlights}
                matchTitle={recorder.matchTitle}
                heroName={recorder.heroName}
                errorMessage={recorder.errorMessage}
                onClearError={recorder.clearError}
                onMatchTitleChange={recorder.setMatchTitle}
                onHeroNameChange={recorder.setHeroName}
                onConnectSource={recorder.connectSource}
                onDisconnectSource={recorder.releaseSource}
                onStartRecording={recorder.startRecording}
                onStopRecording={recorder.stopRecording}
                onTogglePause={recorder.togglePause}
                onAddHighlight={recorder.addHighlightMarker}
                onToggleInternalAudio={() =>
                  handleAudioChange({ internalEnabled: !audioConfig.internalEnabled })
                }
                onToggleMicAudio={() =>
                  handleAudioChange({ micEnabled: !audioConfig.micEnabled })
                }
              />
            </div>

            <div className="lg:col-span-4 space-y-6">
              <AudioMixerPanel
                config={audioConfig}
                stats={recorder.stats}
                hasActiveSource={recorder.hasActiveSource}
                hasInternalAudioTrack={recorder.hasInternalAudioTrack}
                hasMicTrack={recorder.hasMicTrack}
                micDevices={recorder.micDevices}
                onChange={handleAudioChange}
                onRefreshDevices={recorder.refreshDevices}
              />

              <CompressionPanel
                profile={profile}
                isRecording={isRecording}
                codecCapabilities={recorder.codecCapabilities}
                resolvedMimeType={recorder.resolvedMimeType}
                onSelectPreset={handleSelectPreset}
                onUpdateCustom={handleUpdateCustomProfile}
              />
            </div>
          </div>
        )}

        {activeTab === 'mixer' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            <div className="lg:col-span-7">
              <AudioMixerPanel
                config={audioConfig}
                stats={recorder.stats}
                hasActiveSource={recorder.hasActiveSource}
                hasInternalAudioTrack={recorder.hasInternalAudioTrack}
                hasMicTrack={recorder.hasMicTrack}
                micDevices={recorder.micDevices}
                onChange={handleAudioChange}
                onRefreshDevices={recorder.refreshDevices}
              />
            </div>

            <div className="lg:col-span-5 rounded-2xl border border-slate-800/90 bg-[#121722] p-6 space-y-4">
              <h2 className="font-display text-base font-semibold text-slate-100">
                Internal + Mic Signal Check
              </h2>
              <p className="text-sm text-slate-400 leading-relaxed">
                Test your microphone balance against internal game audio before entering a ranked match. Turn on <span className="text-slate-200 font-medium">Practice Signal</span> to generate stereo skill-cast audio and verify Auto-Ducking in real time.
              </p>

              <div className="flex flex-wrap gap-3 pt-1">
                {!recorder.hasActiveSource ? (
                  <button
                    type="button"
                    onClick={() => recorder.connectSource('practice')}
                    className="min-h-[44px] rounded-xl bg-amber-500 hover:bg-amber-400 px-4 py-2 text-sm font-semibold text-slate-950 transition-colors"
                  >
                    Start Practice Audio Signal
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={recorder.releaseSource}
                    className="min-h-[44px] rounded-xl border border-slate-700 bg-slate-900 hover:bg-slate-800 px-4 py-2 text-sm font-medium text-slate-200 transition-colors"
                  >
                    Stop Active Signal
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => setActiveTab('recorder')}
                  className="min-h-[44px] rounded-xl border border-slate-700 bg-slate-900 hover:bg-slate-800 px-4 py-2 text-sm font-medium text-slate-200 transition-colors"
                >
                  Return to Viewfinder
                </button>
              </div>

              <div className="border-t border-slate-800/80 pt-4 space-y-2 text-xs text-slate-400">
                <div className="flex justify-between">
                  <span>Audio Sample Rate</span>
                  <span className="font-mono text-slate-200">48,000 Hz Stereo</span>
                </div>
                <div className="flex justify-between">
                  <span>Internal DSP Bypass</span>
                  <span className="font-mono text-emerald-400">AEC/NS Disabled (Raw)</span>
                </div>
                <div className="flex justify-between">
                  <span>Mic Voice Processing</span>
                  <span className="font-mono text-slate-200">
                    {audioConfig.micNoiseSuppression ? 'NS + AEC Active' : 'Raw Mic'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'vault' && (
          <ClipVault
            clips={clips}
            onDeleteClip={handleDeleteClip}
            onUpdateClipMeta={handleUpdateClipMeta}
            onGoToRecorder={() => setActiveTab('recorder')}
          />
        )}

        {activeTab === 'guide' && (
          <SetupGuide onBackToRecorder={() => setActiveTab('recorder')} />
        )}
      </main>

      {/* Mobile Bottom Tab Bar (under 15% viewport height, >=44px touch targets) */}
      <nav
        aria-label="Mobile navigation"
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 border-t border-slate-800/90 bg-[#0B0E14]/95 backdrop-blur-md"
      >
        <div className="grid grid-cols-4 h-14">
          {(
            [
              { id: 'recorder', label: 'Recorder', Icon: Video },
              { id: 'mixer', label: 'Mixer', Icon: Sliders },
              { id: 'vault', label: 'Vault', Icon: Film },
              { id: 'guide', label: 'Guide', Icon: BookOpen },
            ] as const
          ).map(({ id, label, Icon }) => {
            const active = activeTab === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => setActiveTab(id)}
                className={`min-h-[44px] flex flex-col items-center justify-center gap-0.5 text-[11px] font-medium transition-colors ${
                  active ? 'text-amber-400' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Icon className="h-4 w-4" />
                <span>{label}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
