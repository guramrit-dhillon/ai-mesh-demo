export function renderToken(raw: string): string {
  if (raw === '') return '∅';
  return raw
    .replace(/Ġ/g, '·')
    .replace(/Ċ/g, '↵')
    .replace(/	/g, '→');
}