/**
 * Generates a lightweight 60fps 20:9 Mobile Legends-proportioned practice signal
 * (video track + synthesized stereo internal game audio track) so users can test
 * the compression engine, audio mixer, and auto-ducking without launching a game.
 */
export interface PracticeSignalHandle {
  stream: MediaStream;
  stop: () => void;
}

export function createPracticeSignalStream(
  width = 1280,
  height = 720,
  fps = 60
): PracticeSignalHandle {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { alpha: false });

  let rafId = 0;
  let running = true;
  const startTime = performance.now();

  // Synthesize crisp stereo internal game audio (pad + rhythmic teamfight pings)
  const audioCtx = new AudioContext({ latencyHint: 'playback', sampleRate: 48000 });
  const dest = audioCtx.createMediaStreamDestination();

  const masterGain = audioCtx.createGain();
  masterGain.gain.value = 0.24;
  masterGain.connect(dest);

  // Subtle low ambient arena drone
  const droneOsc = audioCtx.createOscillator();
  droneOsc.type = 'triangle';
  droneOsc.frequency.value = 110;
  const droneFilter = audioCtx.createBiquadFilter();
  droneFilter.type = 'lowpass';
  droneFilter.frequency.value = 320;
  const droneGain = audioCtx.createGain();
  droneGain.gain.value = 0.35;
  droneOsc.connect(droneFilter);
  droneFilter.connect(droneGain);
  droneGain.connect(masterGain);
  droneOsc.start();

  // Periodic synthesized skill-cast chime every 1.4s for realistic internal VU metering
  const pulseInterval = window.setInterval(() => {
    if (!running || audioCtx.state !== 'running') return;
    const now = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    osc.type = 'sine';
    const notes = [440, 554.37, 659.25, 880];
    osc.frequency.setValueAtTime(notes[Math.floor((now * 2) % notes.length)], now);
    osc.frequency.exponentialRampToValueAtTime(220, now + 0.28);

    g.gain.setValueAtTime(0.001, now);
    g.gain.linearRampToValueAtTime(0.45, now + 0.02);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.32);

    osc.connect(g);
    g.connect(masterGain);
    osc.start(now);
    osc.stop(now + 0.34);
  }, 1400);

  const drawFrame = (now: number) => {
    if (!running || !ctx) return;
    const t = (now - startTime) / 1000;

    // Deep arena map backdrop
    const grad = ctx.createLinearGradient(0, 0, width, height);
    grad.addColorStop(0, '#0D1321');
    grad.addColorStop(0.5, '#131C2E');
    grad.addColorStop(1, '#090D16');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);

    // Subtle river & mid-lane diagonal grid
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.08)';
    ctx.lineWidth = 1;
    const step = Math.round(width / 16);
    for (let x = 0; x <= width; x += step) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    for (let y = 0; y <= height; y += step) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    // Mid lane vector
    ctx.strokeStyle = 'rgba(245, 158, 11, 0.16)';
    ctx.lineWidth = Math.max(2, width * 0.004);
    ctx.beginPath();
    ctx.moveTo(width * 0.14, height * 0.85);
    ctx.lineTo(width * 0.86, height * 0.15);
    ctx.stroke();

    // Animated hero position marker sweeping lane
    const heroX = width * 0.5 + Math.cos(t * 1.15) * (width * 0.18);
    const heroY = height * 0.5 + Math.sin(t * 0.85) * (height * 0.18);
    const ringRadius = Math.max(18, width * 0.032) + Math.sin(t * 5) * 4;

    ctx.strokeStyle = '#F59E0B';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(heroX, heroY, ringRadius, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = '#FDE68A';
    ctx.beginPath();
    ctx.arc(heroX, heroY, Math.max(6, width * 0.009), 0, Math.PI * 2);
    ctx.stroke();
    ctx.fill();

    // Simulated minimap square (top-left, MLBB style)
    const mapSize = Math.round(height * 0.24);
    const pad = Math.round(height * 0.04);
    ctx.fillStyle = 'rgba(11, 14, 20, 0.82)';
    ctx.fillRect(pad, pad, mapSize, mapSize);
    ctx.strokeStyle = 'rgba(245, 158, 11, 0.45)';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(pad, pad, mapSize, mapSize);

    // Minimap dot
    const miniX = pad + ((heroX / width) * mapSize);
    const miniY = pad + ((heroY / height) * mapSize);
    ctx.fillStyle = '#10B981';
    ctx.beginPath();
    ctx.arc(miniX, miniY, 4, 0, Math.PI * 2);
    ctx.fill();

    // Simulated skill wheel area (bottom-right)
    const wheelX = width - pad - mapSize * 0.55;
    const wheelY = height - pad - mapSize * 0.45;
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.35)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(wheelX, wheelY, mapSize * 0.32, 0, Math.PI * 2);
    ctx.stroke();

    // Crisp frame pacing sweep bar to verify 60fps smoothness
    ctx.fillStyle = '#F59E0B';
    const sweepX = ((t * 420) % (width - 80)) + 40;
    ctx.fillRect(sweepX, height - 12, 48, 4);

    // Watermark-free clean text overlay for calibration
    ctx.fillStyle = '#E2E8F0';
    ctx.font = `600 ${Math.round(height * 0.028)}px "Plus Jakarta Sans", sans-serif`;
    ctx.fillText('PRACTICE SIGNAL · 60 FPS CALIBRATION', pad + mapSize + 20, pad + 26);
    ctx.fillStyle = '#94A3B8';
    ctx.font = `500 ${Math.round(height * 0.022)}px "JetBrains Mono", monospace`;
    ctx.fillText(`T+${t.toFixed(2)}s  ${width}x${height}`, pad + mapSize + 20, pad + 54);

    rafId = requestAnimationFrame(drawFrame);
  };

  rafId = requestAnimationFrame(drawFrame);

  const canvasStream = canvas.captureStream(fps);
  const combined = new MediaStream([
    ...canvasStream.getVideoTracks(),
    ...dest.stream.getAudioTracks(),
  ]);

  return {
    stream: combined,
    stop: () => {
      running = false;
      cancelAnimationFrame(rafId);
      window.clearInterval(pulseInterval);
      try {
        droneOsc.stop();
        audioCtx.close();
      } catch {
        // ignore close errors
      }
      combined.getTracks().forEach((track) => track.stop());
    },
  };
}
