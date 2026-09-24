import type { Metadata } from "next";
import { JetBrains_Mono, Share_Tech_Mono, VT323 } from "next/font/google";
import "./globals.css";
import { AsciiField } from "@/components/terminal/AsciiField";
import { Crt } from "@/components/terminal/Crt";
import { BootSequence } from "@/components/terminal/BootSequence";

const jet = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jet",
  display: "swap",
});

const vt = VT323({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-vt",
  display: "swap",
});

const share = Share_Tech_Mono({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-share",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://tartarus-rho.vercel.app"),
  title: "TARTARUS // secure code execution sandbox",
  description:
    "Run untrusted, attacker-controlled code safely. WASM/WASI isolation with hard CPU, memory, wall-clock and output limits, a live syscall-style trace, and a public Escape Arena.",
  openGraph: {
    title: "TARTARUS // secure code execution sandbox",
    description:
      "Run untrusted, attacker-controlled code safely. WASM/WASI isolation with hard CPU, memory, wall-clock and output limits, a live syscall-style trace, and a public Escape Arena.",
    images: [{ url: "/tartarus-thumbnail.png", width: 1600, height: 900, type: "image/png" }],
  },
  twitter: {
    card: "summary_large_image",
    images: ["/tartarus-thumbnail.png"],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${jet.variable} ${vt.variable} ${share.variable}`}>
      <body className="min-h-screen antialiased">
        <AsciiField />
        <Crt />
        <BootSequence />
        {children}
      </body>
    </html>
  );
}
