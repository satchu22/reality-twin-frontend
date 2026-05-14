import type { Metadata } from "next";
import AppNavigation from "@/components/AppNavigation";
import NotificationBell from "@/components/NotificationBell";
import RealtimeProvider from "@/components/RealtimeProvider";
import "./globals.css";
import "mapbox-gl/dist/mapbox-gl.css";

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
    <html lang="en" className="h-full antialiased">
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
