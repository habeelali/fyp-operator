import type { Metadata } from "next";
import "./globals.css";
import { SettingsProvider } from "@/contexts/SettingsContext";

export const metadata: Metadata = {
  title: "UGV Operator Control",
  description: "Autonomous UGV Control Interface",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <SettingsProvider>
        <body className="antialiased">{children}</body>
      </SettingsProvider>
    </html>
  );
}
