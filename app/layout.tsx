import type { Metadata } from "next";
import "./globals.css";
import { Navbar } from "@/components/navbar";
import { InstallTray, TrayProvider } from "@/components/tray";
import { getCurrentUser } from "@/lib/auth";

export const metadata: Metadata = {
  title: "AgentHub — Internal Plugin Marketplace",
  description: "Browse, review and share agent skills, MCP servers, plugins and documentation.",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-50 text-slate-900 antialiased">
        <TrayProvider>
          <Navbar />
          <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">{children}</main>
          <InstallTray isLoggedIn={!!user} />
        </TrayProvider>
        <footer className="border-t border-slate-200 py-6 text-center text-xs text-slate-400">
          AgentHub · internal marketplace · submissions are security-scanned and admin-reviewed
        </footer>
      </body>
    </html>
  );
}
