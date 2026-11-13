import { ActiveTab, RecordingStatus } from '../types/recorder';

interface TopBarProps {
  activeTab: ActiveTab;
  onTabChange: (tab: ActiveTab) => void;
  status: RecordingStatus;
  clipCount: number;
  onPrimaryAction: () => void;
}

export function TopBar({
  activeTab,
  onTabChange,
  status,
  clipCount,
  onPrimaryAction,
}: TopBarProps) {
  const isRecording = status === 'recording' || status === 'paused';
  const isBusy = status === 'preparing' || status === 'saving';

  const navItems: Array<{ id: ActiveTab; label: string }> = [
    { id: 'recorder', label: 'Recorder' },
    { id: 'mixer', label: 'Audio Mixer' },
    { id: 'vault', label: clipCount > 0 ? `Clip Vault (${clipCount})` : 'Clip Vault' },
    { id: 'guide', label: 'Setup Guide' },
  ];

  return (
    <header className="sticky top-0 z-30 border-b border-slate-800/80 bg-[#0B0E14]/95 backdrop-blur-md">
      <div className="mx-auto flex max-w-[1440px] items-center justify-between gap-8 px-4 py-3 sm:px-6 lg:px-8">
        {/* Zone 1: Single-element brand wordmark */}
        <button
          type="button"
          onClick={() => onTabChange('recorder')}
          className="font-display text-lg font-bold tracking-tight text-slate-50 whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 rounded-md px-1 py-0.5"
        >
          Landfall Rec
        </button>

        {/* Zone 2: Clean single-line navigation links */}
        <nav
          aria-label="Primary navigation"
          className="hidden md:flex items-center gap-6 text-sm font-medium"
        >
          {navItems.map((item) => {
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onTabChange(item.id)}
                className={`relative py-2 transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 rounded-sm ${
                  active
                    ? 'text-amber-400'
                    : 'text-slate-400 hover:text-slate-100'
                }`}
              >
                {item.label}
                {active && (
                  <span
                    aria-hidden="true"
                    className="absolute inset-x-0 -bottom-[13px] h-[2px] bg-amber-500"
                  />
                )}
              </button>
            );
          })}
        </nav>

        {/* Zone 3: Single primary action button */}
        <div className="flex items-center shrink-0">
          <button
            type="button"
            disabled={isBusy}
            onClick={onPrimaryAction}
            className={`min-h-[40px] px-4 py-2 rounded-lg text-sm font-semibold transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0B0E14] disabled:opacity-60 ${
              isRecording
                ? 'bg-red-600 hover:bg-red-500 text-white focus-visible:ring-red-500'
                : 'bg-amber-500 hover:bg-amber-400 text-slate-950 focus-visible:ring-amber-400'
            }`}
          >
            {status === 'preparing'
              ? 'Preparing...'
              : status === 'saving'
              ? 'Saving Clip...'
              : isRecording
              ? 'Stop & Save'
              : 'Start Recording'}
          </button>
        </div>
      </div>
    </header>
  );
}
