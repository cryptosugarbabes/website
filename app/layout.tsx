import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Crypto Sugar Babes — Go where chemistry takes you",
  description:
    "An adults-only, crypto-native social discovery platform for verified people and memorable connections."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
