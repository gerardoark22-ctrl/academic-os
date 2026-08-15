import { COURSE_COLOR_PALETTE } from '../../utils/cosmetics';

interface ColorPaletteProps {
  value: string;
  onChange: (color: string) => void;
}

export function ColorPalette({ value, onChange }: ColorPaletteProps) {
  return (
    <div>
      <p className="label-clear mb-2 text-xs">Color del curso</p>
      <div className="grid grid-cols-8 gap-2">
        {COURSE_COLOR_PALETTE.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => onChange(c)}
            className={`h-8 w-8 rounded-sm border-2 transition hover:scale-110 ${
              value === c ? 'border-gold-bright ring-2 ring-gold-bright/50' : 'border-ink/50'
            }`}
            style={{ background: c, boxShadow: value === c ? `0 0 12px ${c}` : undefined }}
            title={c}
          />
        ))}
      </div>
    </div>
  );
}
