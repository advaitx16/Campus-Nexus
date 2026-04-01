import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/lib/theme";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Campus Nexus — University Marketplace",
  description: "Buy, sell, and rent student items with escrow-protected payments, AI trust scoring, and real-time campus community.",
  keywords: ["campus marketplace", "student buy sell", "university ecommerce"],
  authors: [{ name: "Campus Nexus" }],
  openGraph: {
    title: "Campus Nexus — University Marketplace",
    description: "The trusted campus marketplace with escrow, AI trust scores, and live community.",
    type: "website",
    siteName: "Campus Nexus",
  },
  manifest: "/manifest.json",
};

export const viewport: Viewport = {
  themeColor: "#4f46e5",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body suppressHydrationWarning className="min-h-full flex flex-col bg-white dark:bg-[#0F0F10] text-gray-900 dark:text-zinc-100 font-sans antialiased overflow-x-hidden">
        <ThemeProvider>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
