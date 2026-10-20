import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { AuthProvider } from "@/lib/auth";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });

export const metadata: Metadata = {
  // Lets link-preview images (WhatsApp, etc.) resolve to full addresses.
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || "https://whispa-nu.vercel.app"),
  title: "Whispa — Say it. Nobody knows.",
  description: "Anonymous campus confessions for Ghana.",
  icons: { icon: "/icons/192.png", apple: "/icons/180.png" },
  appleWebApp: { capable: true, title: "Whispa", statusBarStyle: "default" },
};

export const viewport: Viewport = { themeColor: "#ffffff", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="bg-white font-sans text-ink antialiased">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
