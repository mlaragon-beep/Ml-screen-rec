interface SetupGuideProps {
  onBackToRecorder: () => void;
}

export function SetupGuide({ onBackToRecorder }: SetupGuideProps) {
  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-800/90 bg-[#121722] p-6 sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-800/80 pb-6">
          <div>
            <h1 className="font-display text-2xl font-bold text-slate-50">
              Zero-Lag Mobile Legends Recording Architecture
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-400 leading-relaxed">
              How Landfall Rec keeps Mobile Legends smooth at 60+ fps while capturing stereo internal game audio and live microphone callouts.
            </p>
          </div>
          <button
            type="button"
            onClick={onBackToRecorder}
            className="min-h-[42px] rounded-xl bg-amber-500 hover:bg-amber-400 px-4 py-2 text-sm font-semibold text-slate-950 transition-colors whitespace-nowrap"
          >
            Back to Recorder
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-6">
          <div className="space-y-2">
            <h2 className="font-display text-base font-semibold text-slate-100">
              01. Hardware H.264 Offload
            </h2>
            <p className="text-sm text-slate-400 leading-relaxed">
              Software codecs like VP9 and AV1 compete directly with Mobile Legends&apos; Unity thread on your CPU. Selecting <span className="text-slate-200 font-medium">Zero-Lag Ranked</span> prioritizes hardware H.264 ASIC encoding and sets <code className="font-mono text-xs text-amber-300">contentHint = &quot;motion&quot;</code> so frame pacing stays consistent in 5v5 Lord clashes.
            </p>
          </div>

          <div className="space-y-2">
            <h2 className="font-display text-base font-semibold text-slate-100">
              02. Zero-Copy Stream Pass-Through
            </h2>
            <p className="text-sm text-slate-400 leading-relaxed">
              Instead of copying every video frame through a JavaScript canvas to draw overlays, video frames route straight from capture memory into the hardware encoder. Optional HUD safe-zone guides render only in the local preview layer.
            </p>
          </div>

          <div className="space-y-2">
            <h2 className="font-display text-base font-semibold text-slate-100">
              03. Dual-Bus Raw Stereo + Mic
            </h2>
            <p className="text-sm text-slate-400 leading-relaxed">
              Internal game audio bypasses voice-call noise suppression so skill effects and announcer lines keep full stereo clarity. Noise suppression and echo cancellation run strictly on your microphone bus, with optional Auto-Ducking to dip game volume during callouts.
            </p>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-800/90 bg-[#121722] divide-y divide-slate-800/80">
        <div className="p-6 sm:p-7">
          <h2 className="font-display text-lg font-semibold text-slate-100">
            Best Ways to Capture Mobile Legends Without Phone Lag
          </h2>
          <p className="mt-1 text-sm text-slate-400">
            Choose the workflow that matches your device setup.
          </p>
        </div>

        <div className="p-6 sm:p-7 grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <div className="text-sm font-semibold text-amber-400">
              Method A · USB-C / scrcpy PC Offload (Zero Phone Thermal Throttling)
            </div>
            <ol className="list-decimal list-inside space-y-1.5 text-sm text-slate-300 leading-relaxed">
              <li>Mirror your Android phone to your laptop via USB-C using <code className="font-mono text-xs text-slate-200">scrcpy --audio-codec=opus</code> (Android 11+ forwards internal audio directly).</li>
              <li>Open Landfall Rec on your desktop browser, click <span className="font-medium text-white">Select Screen &amp; Internal Audio</span>, and choose the scrcpy window with audio sharing enabled.</li>
              <li>Enable your headset mic in the Audio Mixer. Your phone runs 100% cool at locked 120 fps while your laptop GPU handles compression.</li>
            </ol>
          </div>

          <div className="space-y-2">
            <div className="text-sm font-semibold text-emerald-400">
              Method B · Direct Android Chrome / Desktop Emulator Capture
            </div>
            <ol className="list-decimal list-inside space-y-1.5 text-sm text-slate-300 leading-relaxed">
              <li>On Android Chrome (or PC emulator like Play Games / BlueStacks), choose <span className="font-medium text-white">Zero-Lag Ranked (720p · 60 fps)</span> or <span className="font-medium text-white">Light Device Saver</span>.</li>
              <li>In Mobile Legends Settings, set Graphics to <span className="font-medium text-white">Smooth</span> or <span className="font-medium text-white">Medium</span>, Frame Rate to <span className="font-medium text-white">High / Super</span>, and disable Outline / Shadow to keep GPU headroom free.</li>
              <li>When prompted by the browser, select <span className="font-medium text-white">Entire Screen</span> or the game window and check <span className="font-medium text-white">Share system audio</span>.</li>
            </ol>
          </div>
        </div>
      </section>
    </div>
  );
}
