import './globals.css';
import { AppProvider } from '@/components/AppProvider';
import { getSettings, DEFAULTS } from '@/lib/settings';
export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';
const color = (c, f) => (/^#[0-9a-fA-F]{6}$/.test(c) ? c : f);
async function load() { try { return await getSettings(); } catch { return DEFAULTS; } }
export async function generateMetadata() { const s = await load(); return { title: s.name, description: s.tagline }; }
export default async function RootLayout({ children }) {
  const s = await load();
  const css = `:root{--brand:${color(s.brand_color, DEFAULTS.brand_color)};--accent:${color(s.accent_color, DEFAULTS.accent_color)}}`;
  return (
    <html lang="en">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@500;700;800&family=Inter:wght@400;500;600&family=Noto+Sans+Ethiopic:wght@400;600;700;800&display=swap" rel="stylesheet" />
        <style dangerouslySetInnerHTML={{ __html: css }} />
      </head>
      <body><AppProvider settings={s}>{children}</AppProvider></body>
    </html>
  );
}
