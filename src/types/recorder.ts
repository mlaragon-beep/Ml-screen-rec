export type CompressionProfileId = 'zero-lag' | 'balanced' | 'montage' | 'saver' | 'custom';

export type PreferredCodec = 'h264' | 'vp8' | 'vp9' | 'av1';

export type ResolutionPreset = '540p' | '720p' | '1080p' | 'native';

export interface CompressionProfile {
  id: CompressionProfileId;
  name: string;
  targetAudience: string;
  resolution: ResolutionPreset;
  fps: 30 | 60 | 90 | 120;
  videoBitrateMbps: number;
  audioBitrateKbps: number;
  preferredCodec: PreferredCodec;
  chunkIntervalMs: 2000 | 3000 | 4000;
  directPassthrough: boolean;
  cpuImpact: 'Minimal' | 'Low' | 'Moderate';
  summary: string;
}

export interface AudioMixerConfig {
  internalEnabled: boolean;
  internalGain: number; // 0 to 1.5
  internalLimiter: boolean;
  micEnabled: boolean;
  micDeviceId: string;
  micGain: number; // 0 to 1.5
  micNoiseSuppression: boolean;
  micEchoCancellation: boolean;
  autoDucking: boolean;
  monitorLocally: boolean;
}

export type HighlightKind = 'Savage' | 'Maniac' | 'Lord Steal' | 'Outplay' | 'Teamfight';

export interface HighlightMarker {
  id: string;
  timestampSec: number;
  label: HighlightKind;
}

export interface RecordedClip {
  id: string;
  title: string;
  hero: string;
  createdAt: number;
  durationSec: number;
  sizeBytes: number;
  mimeType: string;
  width: number;
  height: number;
  avgFps: number;
  videoBitrateMbps: number;
  hasInternalAudio: boolean;
  hasMicAudio: boolean;
  highlights: HighlightMarker[];
  blob: Blob;
}

export interface CodecCapability {
  id: PreferredCodec;
  label: string;
  mimeType: string;
  supported: boolean;
  hardwareAccelerated: boolean | null;
  cpuImpact: 'Minimal' | 'Low' | 'High';
  note: string;
}

export interface LivePerformanceStats {
  elapsedSec: number;
  actualFps: number;
  droppedFrames: number;
  framePacingMs: number;
  mainThreadJitterMs: number;
  encodedBytes: number;
  estBitrateMbps: number;
  internalLevel: number; // 0..1
  micLevel: number; // 0..1
  duckingActive: boolean;
}

export type CaptureSourceMode = 'screen' | 'practice';

export type RecordingStatus = 'idle' | 'preparing' | 'recording' | 'paused' | 'saving';

export type ActiveTab = 'recorder' | 'mixer' | 'vault' | 'guide';
