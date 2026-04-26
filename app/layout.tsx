import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import AppNavigation from "@/components/AppNavigation";
import NotificationBell from "@/components/NotificationBell";
import RealtimeProvider from "@/components/RealtimeProvider";
import "./globals.css";
import "mapbox-gl/dist/mapbox-gl.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "RealityTwin",
  description: "Free-source logistics simulation and route monitoring",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <RealtimeProvider>
          <AppNavigation />
          <NotificationBell userId={1} />
          {children}
        </RealtimeProvider>
      </body>
    </html>
  );
}
