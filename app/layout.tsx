import type { Metadata } from "next";
import { Instrument_Sans, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const instrumentSans = Instrument_Sans({ subsets: ["latin"] });
const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
});

export const metadata: Metadata = {
  title: "Awaken Tax CSV Exporter",
  description:
    "Export wallet transactions to Awaken Tax format for Chiliz, Cronos, Moonbeam, Moonriver, and Lisk",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body
        className={`${instrumentSans.className} ${jetbrainsMono.variable} text-[#1C1917] antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
