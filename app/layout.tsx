import type { Metadata } from "next";
import "./globals.css";
import { Navbar } from "@/components/navbar";

export const metadata: Metadata = {
  title: "AgentHub — Internal Plugin Marketplace",
  description: "Browse, review and share agent skills, MCP servers, plugins and documentation.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-50 text-slate-900 antialiased">
        <Navbar />
        <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">{children}</main>
        <footer className="border-t border-slate-200 py-6 text-center text-xs text-slate-400">
          AgentHub · internal marketplace · submissions are security-scanned and admin-reviewed
        </footer>
      </body>
    </html>
  );
}
