/* Extra pages and a banner for the preview build. The real shop has neither:
 * the preview build (vite.demo.config.js) swaps in src/demo/preview.jsx. */
export const previewRoutes = [];
export function PreviewBanner() { return null; }
export function PreviewDeliveryNote() { return null; }
