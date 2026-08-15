import { EMOJI_CATEGORIES } from '../../utils/cosmetics';

interface EmojiPickerProps {
  value: string;
  onChange: (emoji: string) => void;
}

export function EmojiPicker({ value, onChange }: EmojiPickerProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3 rounded border border-bronze-light/40 bg-ink/30 px-3 py-2">
        <span className="text-3xl">{value || '📚'}</span>
        <span className="body-parchment text-sm">Icono seleccionado</span>
      </div>
      {EMOJI_CATEGORIES.map((cat) => (
        <div key={cat.label}>
          <p className="label-clear mb-1 text-xs">{cat.label}</p>
          <div className="flex flex-wrap gap-1">
            {cat.emojis.map((e) => (
              <button
                key={e}
                type="button"
                onClick={() => onChange(e)}
                className={`flex h-9 w-9 items-center justify-center rounded text-lg transition ${
                  value === e ? 'bg-gold-bright/20 ring-2 ring-gold-bright' : 'hover:bg-ink/40'
                }`}
              >
                {e}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
