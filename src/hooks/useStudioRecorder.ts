import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AudioMixerConfig,
  CaptureSourceMode,
  CodecCapability,
  CompressionProfile,
  HighlightKind,
  HighlightMarker,
  LivePerformanceStats,
  RecordedClip,
  RecordingStatus,
} from '../types/recorder';
import {
  getResolutionDimensions,
  probeDeviceCodecs,
  selectOptimalMimeType,
} from '../utils/compressionEngine';
import { createPracticeSignalStream, PracticeSignalHandle } from '../utils/practiceSignalGenerator';
import { saveClip } from '../utils/clipStorage';

interface UseStudioRecorderOptions {
  profile: CompressionProfile;
  audioConfig: AudioMixerConfig;
  onClipSaved: (clip: RecordedClip) => void;
}

const INITIAL_STATS: LivePerformanceStats = {
  elapsedSec: 0,
  actualFps: 0,
  droppedFrames: 0,
  framePacingMs: 0,
  mainThreadJitterMs: 0,
  encodedBytes: 0,
  estBitrateMbps: 0,
  internalLevel: 0,
  micLevel: 0,
  duckingActive: false,
};

function computeRmsLevel(analyser: AnalyserNode | null, buffer: Uint8Array<ArrayBuffer>): number {
  if (!analyser) return 0;
  analyser.getByteTimeDomainData(buffer);
  let sumSq = 0;
  for (let i = 0; i < buffer.length; i++) {
    const normalized = (buffer[i] - 128) / 128;
    sumSq += normalized * normalized;
  }
  const rms = Math.sqrt(sumSq / buffer.length);
  return Math.min(1, rms * 2.6);
}

export function useStudioRecorder({ profile, audioConfig, onClipSaved }: UseStudioRecorderOptions) {
  const [status, setStatus] = useState<RecordingStatus>('idle');
  const [sourceMode, setSourceMode] = useState<CaptureSourceMode>('screen');
  const [hasActiveSource, setHasActiveSource] = useState(false);
  const [hasInternalAudioTrack, setHasInternalAudioTrack] = useState(false);
  const [hasMicTrack, setHasMicTrack] = useState(false);
  const [micDevices, setMicDevices] = useState<MediaDeviceInfo[]>([]);
  const [codecCapabilities, setCodecCapabilities] = useState<CodecCapability[]>([]);
  const [resolvedMimeType, setResolvedMimeType] = useState<string>('');
  const [highlights, setHighlights] = useState<HighlightMarker[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [stats, setStats] = useState<LivePerformanceStats>(INITIAL_STATS);
  const [matchTitle, setMatchTitle] = useState('Ranked Match');
  const [heroName, setHeroName] = useState('');

  const previewVideoRef = useRef<HTMLVideoElement | null>(null);

  // Active streams & Web Audio nodes
  const displayStreamRef = useRef<MediaStream | null>(null);
  const practiceHandleRef = useRef<PracticeSignalHandle | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const internalSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const internalGainRef = useRef<GainNode | null>(null);
  const internalLimiterRef = useRef<DynamicsCompressorNode | null>(null);
  const internalAnalyserRef = useRef<AnalyserNode | null>(null);

  const micSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const micGainRef = useRef<GainNode | null>(null);
  const micAnalyserRef = useRef<AnalyserNode | null>(null);

  const masterDestRef = useRef<MediaStreamAudioDestinationNode | null>(null);
  const monitorGainRef = useRef<GainNode | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const recordingStartMsRef = useRef<number>(0);
  const pausedDurationMsRef = useRef<number>(0);
  const pauseStartedAtRef = useRef<number>(0);
  const encodedBytesRef = useRef<number>(0);
  const highlightsRef = useRef<HighlightMarker[]>([]);
  const fpsSamplesRef = useRef<number[]>([]);
  const videoMetaRef = useRef<{ width: number; height: number }>({ width: 1280, height: 720 });
  const audioConfigRef = useRef<AudioMixerConfig>(audioConfig);
  const statusRef = useRef<RecordingStatus>(status);

  useEffect(() => {
    audioConfigRef.current = audioConfig;
  }, [audioConfig]);

  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  // Probe hardware codecs and audio input devices on mount
  const refreshDevices = useCallback(async () => {
    if (!navigator.mediaDevices?.enumerateDevices) return;
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      setMicDevices(devices.filter((d) => d.kind === 'audioinput'));
    } catch {
      // ignore enumeration errors
    }
  }, []);

  useEffect(() => {
    probeDeviceCodecs().then(setCodecCapabilities);
    refreshDevices();
    navigator.mediaDevices?.addEventListener?.('devicechange', refreshDevices);
    return () => {
      navigator.mediaDevices?.removeEventListener?.('devicechange', refreshDevices);
    };
  }, [refreshDevices]);

  useEffect(() => {
    const { mimeType } = selectOptimalMimeType(profile.preferredCodec);
    setResolvedMimeType(mimeType);
  }, [profile.preferredCodec]);

  // Ensure Web Audio mixing graph exists
  const ensureAudioGraph = useCallback(async () => {
    if (!audioCtxRef.current || audioCtxRef.current.state === 'closed') {
      const ctx = new AudioContext({ latencyHint: 'playback', sampleRate: 48000 });
      audioCtxRef.current = ctx;

      const dest = ctx.createMediaStreamDestination();
      masterDestRef.current = dest;

      const monitorGain = ctx.createGain();
      monitorGain.gain.value = audioConfigRef.current.monitorLocally ? 0.65 : 0;
      monitorGain.connect(ctx.destination);
      monitorGainRef.current = monitorGain;

      // Internal audio chain
      const intGain = ctx.createGain();
      intGain.gain.value = audioConfigRef.current.internalEnabled ? audioConfigRef.current.internalGain : 0;

      const limiter = ctx.createDynamicsCompressor();
      limiter.threshold.value = -12;
      limiter.knee.value = 12;
      limiter.ratio.value = 6;
      limiter.attack.value = 0.003;
      limiter.release.value = 0.15;

      const intAnalyser = ctx.createAnalyser();
      intAnalyser.fftSize = 256;

      intGain.connect(limiter);
      limiter.connect(intAnalyser);
      intAnalyser.connect(dest);
      intAnalyser.connect(monitorGain);

      internalGainRef.current = intGain;
      internalLimiterRef.current = limiter;
      internalAnalyserRef.current = intAnalyser;

      // Mic audio chain
      const mGain = ctx.createGain();
      mGain.gain.value = audioConfigRef.current.micEnabled ? audioConfigRef.current.micGain : 0;

      const mAnalyser = ctx.createAnalyser();
      mAnalyser.fftSize = 256;

      mGain.connect(mAnalyser);
      mAnalyser.connect(dest);

      micGainRef.current = mGain;
      micAnalyserRef.current = mAnalyser;
    }

    if (audioCtxRef.current.state === 'suspended') {
      await audioCtxRef.current.resume();
    }
    return audioCtxRef.current;
  }, []);

  // Connect or disconnect microphone stream cleanly
  const syncMicStream = useCallback(
    async (enabled: boolean, deviceId: string, ns: boolean, aec: boolean) => {
      if (!enabled) {
        if (micSourceRef.current) {
          micSourceRef.current.disconnect();
          micSourceRef.current = null;
        }
        if (micStreamRef.current) {
          micStreamRef.current.getTracks().forEach((t) => t.stop());
          micStreamRef.current = null;
        }
        setHasMicTrack(false);
        return;
      }

      try {
        const ctx = await ensureAudioGraph();
        if (micSourceRef.current) {
          micSourceRef.current.disconnect();
          micSourceRef.current = null;
        }
        if (micStreamRef.current) {
          micStreamRef.current.getTracks().forEach((t) => t.stop());
        }

        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            deviceId: deviceId ? { exact: deviceId } : undefined,
            noiseSuppression: ns,
            echoCancellation: aec,
            autoGainControl: true,
          },
          video: false,
        });

        micStreamRef.current = stream;
        const source = ctx.createMediaStreamSource(stream);
        if (micGainRef.current) {
          source.connect(micGainRef.current);
        }
        micSourceRef.current = source;
        setHasMicTrack(true);
        refreshDevices();
      } catch (err) {
        setHasMicTrack(false);
        const msg = err instanceof Error ? err.message : 'Microphone permission denied';
        setErrorMessage(`Microphone unavailable: ${msg}`);
      }
    },
    [ensureAudioGraph, refreshDevices]
  );

  // Sync live audio gain/limiter/monitor parameters whenever audioConfig updates
  useEffect(() => {
    const ctx = audioCtxRef.current;
    if (!ctx) return;
    const now = ctx.currentTime;

    if (micGainRef.current) {
      const targetMic = audioConfig.micEnabled ? audioConfig.micGain : 0;
      micGainRef.current.gain.setTargetAtTime(targetMic, now, 0.02);
    }

    if (internalLimiterRef.current) {
      // Bypass compression effect cleanly by setting ratio to 1 when disabled
      internalLimiterRef.current.ratio.setValueAtTime(audioConfig.internalLimiter ? 6 : 1, now);
    }

    if (monitorGainRef.current) {
      monitorGainRef.current.gain.setTargetAtTime(audioConfig.monitorLocally ? 0.65 : 0, now, 0.03);
    }
  }, [audioConfig]);

  // Re-sync mic track if mic toggle, deviceId, NS, or AEC changes while source is active or mic toggled on
  useEffect(() => {
    if (audioConfig.micEnabled) {
      syncMicStream(
        true,
        audioConfig.micDeviceId,
        audioConfig.micNoiseSuppression,
        audioConfig.micEchoCancellation
      );
    } else if (micStreamRef.current) {
      syncMicStream(false, '', false, false);
    }
  }, [
    audioConfig.micEnabled,
    audioConfig.micDeviceId,
    audioConfig.micNoiseSuppression,
    audioConfig.micEchoCancellation,
    syncMicStream,
  ]);

  // Tear down video/internal source streams
  const releaseSource = useCallback(() => {
    if (internalSourceRef.current) {
      internalSourceRef.current.disconnect();
      internalSourceRef.current = null;
    }
    if (practiceHandleRef.current) {
      practiceHandleRef.current.stop();
      practiceHandleRef.current = null;
    }
    if (displayStreamRef.current) {
      displayStreamRef.current.getTracks().forEach((t) => t.stop());
      displayStreamRef.current = null;
    }
    if (previewVideoRef.current) {
      previewVideoRef.current.srcObject = null;
    }
    setHasActiveSource(false);
    setHasInternalAudioTrack(false);
  }, []);

  // Acquire screen + internal audio OR practice signal
  const connectSource = useCallback(
    async (mode: CaptureSourceMode): Promise<MediaStream | null> => {
      setErrorMessage(null);
      releaseSource();
      setSourceMode(mode);

      try {
        const ctx = await ensureAudioGraph();
        const dims = getResolutionDimensions(profile.resolution);
        let stream: MediaStream;

        if (mode === 'practice') {
          const handle = createPracticeSignalStream(dims.width ?? 1280, dims.height ?? 720, profile.fps);
          practiceHandleRef.current = handle;
          stream = handle.stream;
        } else {
          if (!navigator.mediaDevices?.getDisplayMedia) {
            throw new Error(
              'Screen capture API is not available in this browser context. Try Chrome/Edge desktop or Android Chrome, or test with Practice Signal.'
            );
          }

          const videoConstraints: MediaTrackConstraints = {
            frameRate: { ideal: profile.fps, max: profile.fps },
            ...(dims.width ? { width: { ideal: dims.width }, height: { ideal: dims.height } } : {}),
          };

          stream = await navigator.mediaDevices.getDisplayMedia({
            video: videoConstraints,
            // Raw stereo audio: disable voice-call DSP on internal game SFX/music
            audio: {
              echoCancellation: false,
              noiseSuppression: false,
              autoGainControl: false,
              sampleRate: 48000,
              channelCount: 2,
            } as MediaTrackConstraints,
          });
        }

        displayStreamRef.current = stream;

        const videoTrack = stream.getVideoTracks()[0];
        if (videoTrack) {
          // Critical MLBB optimization: tell encoder to prioritize smooth frame motion
          if ('contentHint' in videoTrack) {
            videoTrack.contentHint = 'motion';
          }
          const settings = videoTrack.getSettings();
          videoMetaRef.current = {
            width: settings.width ?? dims.width ?? 1280,
            height: settings.height ?? dims.height ?? 720,
          };

          videoTrack.onended = () => {
            if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
              mediaRecorderRef.current.stop();
            } else {
              releaseSource();
            }
          };
        }

        const internalTracks = stream.getAudioTracks();
        if (internalTracks.length > 0) {
          const intStream = new MediaStream([internalTracks[0]]);
          const intSource = ctx.createMediaStreamSource(intStream);
          if (internalGainRef.current) {
            intSource.connect(internalGainRef.current);
          }
          internalSourceRef.current = intSource;
          setHasInternalAudioTrack(true);
        } else {
          setHasInternalAudioTrack(false);
        }

        if (previewVideoRef.current) {
          previewVideoRef.current.srcObject = stream;
          previewVideoRef.current.muted = true;
          await previewVideoRef.current.play().catch(() => undefined);
        }

        setHasActiveSource(true);
        return stream;
      } catch (err) {
        const name = err instanceof DOMException ? err.name : '';
        if (name === 'NotAllowedError') {
          setErrorMessage(
            'Screen capture permission was cancelled or blocked by this frame. Allow screen sharing or use Practice Signal to test the mixer and compression engine.'
          );
        } else {
          setErrorMessage(err instanceof Error ? err.message : 'Unable to start screen capture');
        }
        return null;
      }
    },
    [ensureAudioGraph, profile.fps, profile.resolution, releaseSource]
  );

  const stopRecording = useCallback(() => {
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== 'inactive') {
      setStatus('saving');
      recorder.stop();
    }
  }, []);

  const startRecording = useCallback(
    async (explicitMode?: CaptureSourceMode) => {
      if (statusRef.current === 'recording' || statusRef.current === 'preparing') return;
      setErrorMessage(null);
      setStatus('preparing');

      let activeStream = displayStreamRef.current;
      if (!activeStream || (explicitMode && explicitMode !== sourceMode)) {
        activeStream = await connectSource(explicitMode ?? sourceMode);
      }

      if (!activeStream) {
        setStatus('idle');
        return;
      }

      // If mic is enabled and not yet captured, initialize it before building output tracks
      if (audioConfigRef.current.micEnabled && !micStreamRef.current) {
        await syncMicStream(
          true,
          audioConfigRef.current.micDeviceId,
          audioConfigRef.current.micNoiseSuppression,
          audioConfigRef.current.micEchoCancellation
        );
      }

      const videoTrack = activeStream.getVideoTracks()[0];
      if (!videoTrack) {
        setErrorMessage('No video track found in capture source.');
        setStatus('idle');
        return;
      }

      // Direct zero-copy stream pass-through + mixed stereo audio destination
      const tracks: MediaStreamTrack[] = [videoTrack];
      const mixedAudioTrack = masterDestRef.current?.stream.getAudioTracks()[0];
      if (mixedAudioTrack) {
        tracks.push(mixedAudioTrack);
      }

      const combinedStream = new MediaStream(tracks);
      const { mimeType } = selectOptimalMimeType(profile.preferredCodec);
      setResolvedMimeType(mimeType);

      recordedChunksRef.current = [];
      encodedBytesRef.current = 0;
      highlightsRef.current = [];
      fpsSamplesRef.current = [];
      setHighlights([]);
      pausedDurationMsRef.current = 0;
      pauseStartedAtRef.current = 0;

      const options: MediaRecorderOptions = {
        mimeType,
        videoBitsPerSecond: Math.round(profile.videoBitrateMbps * 1_000_000),
        audioBitsPerSecond: profile.audioBitrateKbps * 1000,
      };

      let recorder: MediaRecorder;
      try {
        recorder = new MediaRecorder(combinedStream, options);
      } catch {
        recorder = new MediaRecorder(combinedStream);
      }

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          recordedChunksRef.current.push(event.data);
          encodedBytesRef.current += event.data.size;
        }
      };

      recorder.onstop = async () => {
        const finalDurationSec = Math.max(
          1,
          (performance.now() - recordingStartMsRef.current - pausedDurationMsRef.current) / 1000
        );
        const finalMime = recorder.mimeType || mimeType || 'video/webm';
        const blob = new Blob(recordedChunksRef.current, { type: finalMime });
        const avgFps =
          fpsSamplesRef.current.length > 0
            ? Math.round(
                fpsSamplesRef.current.reduce((a, b) => a + b, 0) / fpsSamplesRef.current.length
              )
            : profile.fps;

        const clip: RecordedClip = {
          id: `clip_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          title: matchTitle.trim() || 'Ranked Match',
          hero: heroName.trim() || 'All Heroes',
          createdAt: Date.now(),
          durationSec: finalDurationSec,
          sizeBytes: blob.size,
          mimeType: finalMime,
          width: videoMetaRef.current.width,
          height: videoMetaRef.current.height,
          avgFps,
          videoBitrateMbps: Number(((blob.size * 8) / finalDurationSec / 1_000_000).toFixed(2)),
          hasInternalAudio:
            audioConfigRef.current.internalEnabled && activeStream.getAudioTracks().length > 0,
          hasMicAudio: audioConfigRef.current.micEnabled && Boolean(micStreamRef.current),
          highlights: [...highlightsRef.current],
          blob,
        };

        try {
          await saveClip(clip);
          onClipSaved(clip);
        } catch (err) {
          setErrorMessage(
            err instanceof Error ? `Failed to save clip: ${err.message}` : 'Failed to save clip'
          );
        } finally {
          mediaRecorderRef.current = null;
          setStatus('idle');
          setStats((prev) => ({
            ...prev,
            elapsedSec: 0,
            encodedBytes: 0,
            estBitrateMbps: 0,
          }));
        }
      };

      mediaRecorderRef.current = recorder;
      recordingStartMsRef.current = performance.now();
      recorder.start(profile.chunkIntervalMs);
      setStatus('recording');
    },
    [
      connectSource,
      heroName,
      matchTitle,
      onClipSaved,
      profile.audioBitrateKbps,
      profile.chunkIntervalMs,
      profile.preferredCodec,
      profile.videoBitrateMbps,
      profile.fps,
      sourceMode,
      syncMicStream,
    ]
  );

  const togglePause = useCallback(() => {
    const recorder = mediaRecorderRef.current;
    if (!recorder) return;
    if (recorder.state === 'recording') {
      recorder.pause();
      pauseStartedAtRef.current = performance.now();
      setStatus('paused');
    } else if (recorder.state === 'paused') {
      pausedDurationMsRef.current += performance.now() - pauseStartedAtRef.current;
      recorder.resume();
      setStatus('recording');
    }
  }, []);

  const addHighlightMarker = useCallback((label: HighlightKind) => {
    if (statusRef.current !== 'recording' && statusRef.current !== 'paused') return;
    const now = performance.now();
    const pausedMs =
      statusRef.current === 'paused'
        ? pausedDurationMsRef.current + (now - pauseStartedAtRef.current)
        : pausedDurationMsRef.current;
    const timestampSec = Math.max(0, (now - recordingStartMsRef.current - pausedMs) / 1000);
    const marker: HighlightMarker = {
      id: `hl_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
      timestampSec,
      label,
    };
    highlightsRef.current = [...highlightsRef.current, marker];
    setHighlights(highlightsRef.current);
  }, []);

  // Real-time VU metering + auto-ducking + FPS frame-pacing + main-thread jitter loop
  useEffect(() => {
    const intBuffer = new Uint8Array(new ArrayBuffer(128));
    const micBuffer = new Uint8Array(new ArrayBuffer(128));

    let rafId = 0;
    let rvfcId = 0;
    let lastTick = performance.now();
    let frameCountWindow = 0;
    let lastFpsStamp = performance.now();
    let lastVideoFrameTime = 0;
    let measuredFps = 0;
    let measuredPacingMs = 0;
    let lastStatCommit = 0;

    // Frame pacing via requestVideoFrameCallback when supported
    const videoEl = previewVideoRef.current as
      | (HTMLVideoElement & {
          requestVideoFrameCallback?: (cb: (now: number, meta: VideoFrameCallbackMetadata) => void) => number;
          cancelVideoFrameCallback?: (id: number) => void;
        })
      | null;

    const onVideoFrame = (now: number) => {
      frameCountWindow += 1;
      if (lastVideoFrameTime > 0) {
        measuredPacingMs = now - lastVideoFrameTime;
      }
      lastVideoFrameTime = now;

      if (now - lastFpsStamp >= 500) {
        measuredFps = Math.round((frameCountWindow * 1000) / (now - lastFpsStamp));
        if (statusRef.current === 'recording' && measuredFps > 0) {
          fpsSamplesRef.current.push(measuredFps);
        }
        frameCountWindow = 0;
        lastFpsStamp = now;
      }

      if (videoEl?.requestVideoFrameCallback && hasActiveSource) {
        rvfcId = videoEl.requestVideoFrameCallback(onVideoFrame);
      }
    };

    if (videoEl?.requestVideoFrameCallback && hasActiveSource) {
      rvfcId = videoEl.requestVideoFrameCallback(onVideoFrame);
    }

    const tick = (now: number) => {
      const delta = now - lastTick;
      lastTick = now;
      // Estimate scheduling jitter relative to 16.67ms 60Hz baseline
      const jitter = Math.max(0, Math.abs(delta - 16.67));

      const cfg = audioConfigRef.current;
      const internalLevel = cfg.internalEnabled
        ? computeRmsLevel(internalAnalyserRef.current, intBuffer)
        : 0;
      const micLevel = cfg.micEnabled ? computeRmsLevel(micAnalyserRef.current, micBuffer) : 0;

      // Auto-ducking: gently attenuate game audio when player speaks into mic
      const duckingActive = Boolean(cfg.autoDucking && cfg.micEnabled && micLevel > 0.14);
      if (internalGainRef.current && audioCtxRef.current) {
        const baseGain = cfg.internalEnabled ? cfg.internalGain : 0;
        const targetGain = duckingActive ? baseGain * 0.52 : baseGain;
        const tau = duckingActive ? 0.08 : 0.28;
        internalGainRef.current.gain.setTargetAtTime(
          targetGain,
          audioCtxRef.current.currentTime,
          tau
        );
      }

      if (now - lastStatCommit >= 100) {
        lastStatCommit = now;
        const isRec = statusRef.current === 'recording';
        const isPaused = statusRef.current === 'paused';
        const elapsedSec =
          isRec || isPaused
            ? Math.max(
                0,
                (now -
                  recordingStartMsRef.current -
                  (isPaused
                    ? pausedDurationMsRef.current + (now - pauseStartedAtRef.current)
                    : pausedDurationMsRef.current)) /
                  1000
              )
            : 0;

        const quality = (
          previewVideoRef.current as
            | (HTMLVideoElement & { getVideoPlaybackQuality?: () => VideoPlaybackQuality })
            | null
        )?.getVideoPlaybackQuality?.();

        const encodedBytes = encodedBytesRef.current;
        const estBitrateMbps =
          elapsedSec > 0.5 ? Number(((encodedBytes * 8) / elapsedSec / 1_000_000).toFixed(2)) : 0;

        setStats({
          elapsedSec,
          actualFps: hasActiveSource ? measuredFps : 0,
          droppedFrames: quality?.droppedVideoFrames ?? 0,
          framePacingMs: Number(measuredPacingMs.toFixed(1)),
          mainThreadJitterMs: Number(jitter.toFixed(1)),
          encodedBytes,
          estBitrateMbps,
          internalLevel,
          micLevel,
          duckingActive,
        });
      }

      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(rafId);
      if (videoEl?.cancelVideoFrameCallback && rvfcId) {
        videoEl.cancelVideoFrameCallback(rvfcId);
      }
    };
  }, [hasActiveSource]);

  // Cleanup everything on unmount
  useEffect(() => {
    return () => {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
      releaseSource();
      if (micStreamRef.current) {
        micStreamRef.current.getTracks().forEach((t) => t.stop());
      }
      if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
        audioCtxRef.current.close().catch(() => undefined);
      }
    };
  }, [releaseSource]);

  return {
    previewVideoRef,
    status,
    sourceMode,
    hasActiveSource,
    hasInternalAudioTrack,
    hasMicTrack,
    micDevices,
    codecCapabilities,
    resolvedMimeType,
    highlights,
    errorMessage,
    stats,
    matchTitle,
    setMatchTitle,
    heroName,
    setHeroName,
    clearError: () => setErrorMessage(null),
    connectSource,
    releaseSource,
    startRecording,
    stopRecording,
    togglePause,
    addHighlightMarker,
    refreshDevices,
  };
}
