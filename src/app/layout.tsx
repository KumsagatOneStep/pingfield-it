import type { Metadata } from "next";
import { IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";
import "./globals.css";
import DemoBanner from "./DemoBanner";

const sans = IBM_Plex_Sans({ subsets: ["latin", "cyrillic"], weight: ["400", "500", "600", "700"], variable: "--font-sans" });
const mono = IBM_Plex_Mono({ subsets: ["latin", "cyrillic"], weight: ["400", "500", "600"], variable: "--font-mono" });

const THEME_SCRIPT =
  "try{var t=localStorage.getItem('theme');if(t==='light'||t==='dark')document.documentElement.dataset.theme=t}catch(e){}";

export const metadata: Metadata = {
  title: "Pingfield Demo",
  description: "Реестр принтеров, акты ТМЦ и учёт картриджей — демо-версия с выдуманными данными.",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru" className={`${sans.variable} ${mono.variable}`} suppressHydrationWarning>
      <head>
        {/* Day/night choice before first paint (see theme.ts). */}
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body>
        <DemoBanner />
        {children}
      </body>
    </html>
  );
}
