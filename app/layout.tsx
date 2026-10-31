import type { Metadata } from "next";
import "./globals.css";
import { Toaster } from "sonner";
import { Navbar } from "@/components/navbar";
import { InstallTray, TrayProvider } from "@/components/tray";
import { CompareBar, CompareProvider } from "@/components/compare";
import { FavoritesProvider } from "@/components/favorites";
import { CommandPaletteProvider } from "@/components/command-palette";
import { PointerSpotlight } from "@/components/pointer-spotlight";
import { Footer } from "@/components/footer";
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
        <CompareProvider>
        <FavoritesProvider>
        <CommandPaletteProvider isAdmin={!!user?.is_admin}>
          <PointerSpotlight />
          <Navbar />
          <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">{children}</main>
          <InstallTray isLoggedIn={!!user} />
          <CompareBar />
          <Footer isAdmin={!!user?.is_admin} />
        </CommandPaletteProvider>
        </FavoritesProvider>
        </CompareProvider>
        </TrayProvider>
        <Toaster position="top-center" richColors />
      </body>
    </html>
  );
}
