import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "WARRANT // Attributed Multi-Hop Research Agent",
  description:
    "Enterprise-grade multi-hop research verification engine with claim-level NLI verification, deterministic guard rails, and a 3-state abstention contract.",
  icons: {
    icon: "/favicon.ico",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-background text-slate-100 font-sans antialiased selection:bg-emerald-500/20 selection:text-emerald-200">
        {children}
      </body>
    </html>
  );
}
