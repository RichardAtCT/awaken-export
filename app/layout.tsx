import type { Metadata } from "next";
import "./globals.css";

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
      <body className="bg-white text-gray-900 antialiased">{children}</body>
    </html>
  );
}
