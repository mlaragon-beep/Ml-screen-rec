import {
  CodecCapability,
  CompressionProfile,
  CompressionProfileId,
  PreferredCodec,
  ResolutionPreset,
} from '../types/recorder';

export const COMPRESSION_PROFILES: Record<Exclude<CompressionProfileId, 'custom'>, CompressionProfile> = {
  'zero-lag': {
    id: 'zero-lag',
    name: 'Zero-Lag Ranked',
    targetAudience: 'Mythic ranked stability',
    resolution: '720p',
    fps: 60,
    videoBitrateMbps: 4.5,
    audioBitrateKbps: 128,
    preferredCodec: 'h264',
    chunkIntervalMs: 4000,
    directPassthrough: true,
    cpuImpact: 'Minimal',
    summary: 'Hardware H.264 with 4s buffer flushes keeps Unity frame pacing locked at 60 fps.',
  },
  balanced: {
    id: 'balanced',
    name: 'Balanced Clash',
    targetAudience: 'Crisp skill effects & minimap',
    resolution: '1080p',
    fps: 60,
    videoBitrateMbps: 8.0,
    audioBitrateKbps: 160,
    preferredCodec: 'h264',
    chunkIntervalMs: 3000,
    directPassthrough: true,
    cpuImpact: 'Low',
    summary: 'Full HD capture with hardware-offloaded compression and stereo game audio.',
  },
  montage: {
    id: 'montage',
    name: 'Montage Master',
    targetAudience: 'TikTok & YouTube edits',
    resolution: '1080p',
    fps: 60,
    videoBitrateMbps: 14.0,
    audioBitrateKbps: 192,
    preferredCodec: 'h264',
    chunkIntervalMs: 2000,
    directPassthrough: true,
    cpuImpact: 'Moderate',
    summary: 'High-bitrate stream for rapid dash heroes like Fanny, Ling, and Gusion.',
  },
  saver: {
    id: 'saver',
    name: 'Light Device Saver',
    targetAudience: 'Low-RAM phones & long sessions',
    resolution: '540p',
    fps: 30,
    videoBitrateMbps: 2.2,
    audioBitrateKbps: 96,
    preferredCodec: 'vp8',
    chunkIntervalMs: 4000,
    directPassthrough: true,
    cpuImpact: 'Minimal',
    summary: 'Ultra-lightweight footprint (~16 MB/min) to prevent thermal throttling.',
  },
};

export function getResolutionDimensions(preset: ResolutionPreset): { width?: number; height?: number } {
  switch (preset) {
    case '540p':
      return { width: 960, height: 540 };
    case '720p':
      return { width: 1280, height: 720 };
    case '1080p':
      return { width: 1920, height: 1080 };
    case 'native':
    default:
      return {};
  }
}

const CODEC_CANDIDATES: Record<PreferredCodec, string[]> = {
  h264: [
    'video/webm;codecs=h264,opus',
    'video/webm;codecs=avc1.42E01E,opus',
    'video/mp4;codecs=avc1.42E01E,mp4a.40.2',
    'video/webm;codecs=h264',
  ],
  vp8: ['video/webm;codecs=vp8,opus', 'video/webm;codecs=vp8'],
  vp9: ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp9'],
  av1: ['video/webm;codecs=av01.0.04M.08,opus', 'video/webm;codecs=av1,opus'],
};

const WEBCODECS_STRINGS: Record<PreferredCodec, string> = {
  h264: 'avc1.42001f',
  vp8: 'vp8',
  vp9: 'vp09.00.10.08',
  av1: 'av01.0.04M.08',
};

export function selectOptimalMimeType(preferred: PreferredCodec): {
  mimeType: string;
  resolvedCodec: PreferredCodec;
} {
  if (typeof MediaRecorder === 'undefined') {
    return { mimeType: 'video/webm', resolvedCodec: 'vp8' };
  }

  // Order fallback safely: always prefer hardware-friendly H264 -> VP8 before heavier codecs
  const order: PreferredCodec[] = [
    preferred,
    ...(['h264', 'vp8', 'vp9', 'av1'] as PreferredCodec[]).filter((c) => c !== preferred),
  ];

  for (const codec of order) {
    for (const candidate of CODEC_CANDIDATES[codec]) {
      if (MediaRecorder.isTypeSupported(candidate)) {
        return { mimeType: candidate, resolvedCodec: codec };
      }
    }
  }

  return { mimeType: 'video/webm', resolvedCodec: 'vp8' };
}

export async function probeDeviceCodecs(): Promise<CodecCapability[]> {
  const specs: Array<{
    id: PreferredCodec;
    label: string;
    cpuImpact: 'Minimal' | 'Low' | 'High';
    note: string;
  }> = [
    {
      id: 'h264',
      label: 'H.264 / AVC',
      cpuImpact: 'Minimal',
      note: 'Uses dedicated GPU/ASIC encoder; best for zero MLBB lag.',
    },
    {
      id: 'vp8',
      label: 'VP8',
      cpuImpact: 'Low',
      note: 'Fast real-time fallback with low memory overhead.',
    },
    {
      id: 'vp9',
      label: 'VP9',
      cpuImpact: 'High',
      note: 'Smaller files but higher CPU usage during intense teamfights.',
    },
    {
      id: 'av1',
      label: 'AV1',
      cpuImpact: 'High',
      note: 'Next-gen compression; avoid without dedicated AV1 hardware.',
    },
  ];

  const results = await Promise.all(
    specs.map(async (spec) => {
      let supportedMime = '';
      if (typeof MediaRecorder !== 'undefined') {
        for (const candidate of CODEC_CANDIDATES[spec.id]) {
          if (MediaRecorder.isTypeSupported(candidate)) {
            supportedMime = candidate;
            break;
          }
        }
      }

      let hardwareAccelerated: boolean | null = null;
      if (typeof window !== 'undefined' && 'VideoEncoder' in window) {
        try {
          const VideoEncoderCtor = (window as unknown as {
            VideoEncoder: {
              isConfigSupported: (cfg: Record<string, unknown>) => Promise<{ supported?: boolean }>;
            };
          }).VideoEncoder;
          const hwCheck = await VideoEncoderCtor.isConfigSupported({
            codec: WEBCODECS_STRINGS[spec.id],
            width: 1280,
            height: 720,
            bitrate: 4_500_000,
            framerate: 60,
            hardwareAcceleration: 'prefer-hardware',
          });
          if (hwCheck.supported) {
            hardwareAccelerated = true;
          } else {
            hardwareAccelerated = false;
          }
        } catch {
          hardwareAccelerated = null;
        }
      }

      return {
        id: spec.id,
        label: spec.label,
        mimeType: supportedMime || CODEC_CANDIDATES[spec.id][0],
        supported: Boolean(supportedMime),
        hardwareAccelerated,
        cpuImpact: spec.cpuImpact,
        note: spec.note,
      };
    })
  );

  return results;
}

export function formatDuration(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  const hrs = Math.floor(total / 3600);
  const mins = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  if (hrs > 0) {
    return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export function formatBytes(bytes: number): string {
  if (bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const idx = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  const val = bytes / Math.pow(1024, idx);
  return `${val >= 100 ? val.toFixed(0) : val.toFixed(1)} ${units[idx]}`;
}

export function estimateSizePerMinuteMB(videoMbps: number, audioKbps: number): number {
  const totalBitsPerSec = videoMbps * 1_000_000 + audioKbps * 1000;
  return (totalBitsPerSec * 60) / 8 / (1024 * 1024);
}
