"use client";

import ShadowTerminal from "./ShadowTerminal";
import { PrivacyEducation } from "@/components/PrivacyEducation";

import Navbar from "@/components/Navbar";

export default function Home() {
  return (
    <main className="min-h-screen bg-background flex flex-col items-center p-4 md:p-8 font-sans text-foreground">
      <Navbar />

      {/* --- SHADOW TERMINAL --- */}
      <div className="w-full flex justify-center animate-fade-in-up">
        <ShadowTerminal />
      </div>

      {/* --- SURVEILLANCE EDUCATION (Encrypt.trade Track 1 & 2) --- */}
      <div className="w-full max-w-3xl mx-auto">
        <PrivacyEducation />
      </div>

      {/* --- FOOTER --- */}
      <div className="mt-16 text-center space-y-2 opacity-60 hover:opacity-100 transition-opacity">
        <p className="text-xs text-muted-foreground uppercase font-bold tracking-widest">Hackathon Build</p>
        <div className="flex justify-center gap-4 text-[10px] text-muted-foreground font-mono">
          <span>Radr Labs (Privacy)</span>
          <span>•</span>
          <span>Helius (RPC)</span>
          <span>•</span>
          <span>Range (Compliance)</span>
          <span>•</span>
          <span>Encrypt.trade (Edu)</span>
        </div>
      </div>
    </main>
  );
}
