import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

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
    <html lang="en" className="dark">
      <body className={`${inter.className} text-white antialiased`}>
        {children}
      </body>
    </html>
  );
}
