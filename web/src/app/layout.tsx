import type { Metadata } from "next";
import { JetBrains_Mono } from "next/font/google";
import "./globals.css";

const jet = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jet",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Tartarus — Secure Code Execution Sandbox",
  description:
    "Run untrusted, attacker-controlled code safely. WASM/WASI isolation with hard CPU, memory, wall-clock and output limits, a live syscall-style trace, and a public Escape Arena.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={jet.variable}>
      <body className="min-h-screen antialiased">
        <div className="crt" aria-hidden />
        <div className="scanbeam" aria-hidden />
        {children}
      </body>
    </html>
  );
}
