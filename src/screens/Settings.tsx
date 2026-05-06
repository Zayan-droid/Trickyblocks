import { useNavigate } from 'react-router-dom';
import { useSettingsStore } from '@/store/settingsStore';
import { setMusicVolume } from '@/game/audio';

export default function Settings() {
  const nav = useNavigate();
  const settings = useSettingsStore();

  return (
    <div className="relative h-full w-full overflow-y-auto px-4 sm:px-6 py-8 sm:py-10 pt-[max(env(safe-area-inset-top),32px)] pb-[max(env(safe-area-inset-bottom),32px)] flex justify-center">
      <div className="w-full max-w-lg flex flex-col gap-5 animate-rise">
        <h2 className="text-3xl font-display accent-text">SETTINGS</h2>

        <div className="panel p-5 flex flex-col gap-4">
          <SliderRow
            label="Music"
            value={settings.musicVolume}
            onChange={(v) => {
              settings.setMusicVolume(v);
              setMusicVolume(v);
            }}
          />
          <SliderRow
            label="Sound effects"
            value={settings.sfxVolume}
            onChange={settings.setSfxVolume}
          />
          <ToggleRow
            label="Haptics (vibration)"
            value={settings.hapticsEnabled}
            onChange={settings.setHaptics}
          />
          <ToggleRow
            label="Color-blind mode"
            value={settings.colorBlindMode}
            onChange={settings.setColorBlind}
          />
          <ToggleRow
            label="Reduce motion"
            value={settings.reduceMotion}
            onChange={settings.setReduceMotion}
          />
          <SliderRow
            label="Physics sensitivity"
            value={(settings.physicsSensitivity - 0.5) / 1}
            onChange={(v) => settings.setPhysicsSensitivity(0.5 + v)}
          />
        </div>

        <button onClick={() => nav(-1)} className="btn-primary mt-3">
          Back
        </button>
      </div>
    </div>
  );
}

function SliderRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="flex items-center justify-between gap-3 sm:gap-4">
      <span className="text-white/85 shrink-0">{label}</span>
      <input
        type="range"
        min={0}
        max={1}
        step={0.01}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="flex-1 min-w-0 max-w-44 accent-accent"
      />
    </label>
  );
}

function ToggleRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center justify-between gap-4 cursor-pointer">
      <span className="text-white/85">{label}</span>
      <span
        onClick={() => onChange(!value)}
        className={`w-12 h-7 rounded-full p-1 transition-colors ${value ? 'bg-accent' : 'bg-surface-2 border border-white/10'}`}
      >
        <span
          className={`block w-5 h-5 rounded-full bg-white transition-transform ${value ? 'translate-x-5' : ''}`}
        />
      </span>
    </label>
  );
}
