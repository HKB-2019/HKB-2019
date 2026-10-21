/** "THE MASQ. BEANIE" → "The MASQ. Beanie": a piece's name as the Shop designs set it. */
export const titleCase = (name) => name.split(' ')
  .map(w => (w.includes('.') || w.length < 2 || /^\d/.test(w) ? w : w[0] + w.slice(1).toLowerCase())).join(' ');
