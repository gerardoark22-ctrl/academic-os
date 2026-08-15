/** Formato compacto para títulos de unidad en la tarjeta */

export interface UnitDisplayParts {
  badge: string;
  detail: string | null;
  full: string;
}

const UNIT_PREFIX = /^(unidad\s+[IVXLC\d]+)\s*:?\s*(.*)$/i;

export function parseUnitDisplayName(name: string): UnitDisplayParts {
  const trimmed = name.trim();
  const match = trimmed.match(UNIT_PREFIX);
  if (match) {
    const detail = match[2]?.trim() || null;
    return {
      badge: match[1].replace(/\b\w/g, (c) => c.toUpperCase()),
      detail,
      full: trimmed,
    };
  }
  return { badge: trimmed, detail: null, full: trimmed };
}

export function formatUnitLine(name: string): string {
  const { badge, detail } = parseUnitDisplayName(name);
  return detail ? `${badge}: ${detail}` : badge;
}

/** Nombre corto sugerido al crear unidades */
export function suggestShortUnitName(index: number): string {
  const n = index + 1;
  const romans = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];
  const num = romans[n - 1] ?? String(n);
  return `Unidad ${num}`;
}
