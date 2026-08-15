const inFlight = new Set<string>();

export function beginBlockCompletion(blockId: string): boolean {
  if (inFlight.has(blockId)) return false;
  inFlight.add(blockId);
  return true;
}

export function endBlockCompletion(blockId: string): void {
  inFlight.delete(blockId);
}
