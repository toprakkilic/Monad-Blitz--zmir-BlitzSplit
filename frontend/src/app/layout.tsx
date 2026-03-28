import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Providers from "./providers";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Monad SplitIt 🎲 | Roulette Bill Splitting",
  description:
    "Web3-powered roulette bill splitting on Monad. Zero-gas permits, EIP-2612, and pure chaos.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-gray-950 text-white font-[family-name:var(--font-inter)]">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
