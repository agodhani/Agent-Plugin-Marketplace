"use client";

import { useEffect, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Boxes, Heart, ListChecks, Menu, Search, ShieldCheck, Upload, Users, X } from "lucide-react";
import { logoutAction } from "@/lib/actions";
import { useCommandPalette } from "./command-palette";
import { useIsMac } from "./use-is-mac";

const LINKS = [
  { href: "/", label: "Browse", icon: null },
  { href: "/playbooks", label: "Playbooks", icon: ListChecks },
  { href: "/submit", label: "Submit", icon: Upload },
  { href: "/favorites", label: "Favorites", icon: Heart },
  { href: "/teams", label: "Teams", icon: Users },
];

export function NavbarClient({ user }: { user: { name: string; is_admin: number } | null }) {
  const [scrolled, setScrolled] = useState(false);
  const pathname = usePathname();
  const { open } = useCommandPalette();
  const isMac = useIsMac();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);

  return (
    <header
      className={`sticky top-0 z-40 bg-white/70 backdrop-blur-xl transition-[border-color,box-shadow] duration-300 ${
        scrolled ? "border-b border-slate-200 shadow-[0_10px_30px_-15px_rgb(15_23_42/0.25)]" : "border-b border-transparent"
      }`}
    >
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-4 px-4 sm:px-6">
        <Link href="/" className="flex shrink-0 items-center gap-2 font-semibold text-slate-900">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-md shadow-indigo-500/40">
            <Boxes className="h-4 w-4" />
          </span>
          AgentHub
          <span className="hidden rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-500 sm:inline">
            internal
          </span>
        </Link>
        <nav className="hidden min-w-0 flex-1 items-center gap-1 text-sm md:flex">
          {LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 font-medium transition duration-200 ${
                isActive(l.href)
                  ? "bg-slate-900/[.07] text-slate-900"
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
              }`}
            >
              {l.icon && <l.icon className="h-3.5 w-3.5" />}
              {l.label}
            </Link>
          ))}
          {user?.is_admin ? (
            <Link
              href="/admin"
              className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 font-medium transition duration-200 ${
                isActive("/admin")
                  ? "bg-indigo-100 text-indigo-700"
                  : "text-indigo-600 hover:bg-indigo-50"
              }`}
            >
              <ShieldCheck className="h-3.5 w-3.5" /> Review
            </Link>
          ) : null}
        </nav>
        <div className="flex min-w-0 flex-1 items-center justify-end gap-2.5 md:flex-none">
          <MobileNav user={user} />
          <button
            type="button"
            onClick={open}
            aria-label="Search the catalog"
            className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white/60 px-2.5 py-1.5 text-sm text-slate-500 transition duration-200 hover:border-indigo-300 hover:text-slate-700"
          >
            <Search className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Search…</span>
            <kbd className="hidden rounded border border-slate-200 bg-slate-50 px-1 py-0.5 font-sans text-[10px] font-medium text-slate-400 sm:inline">
              {isMac ? "⌘K" : "Ctrl K"}
            </kbd>
          </button>
          {user ? (
            <>
              <Link
                href="/profile"
                className="flex items-center gap-2 rounded-full border border-slate-200 py-1 pl-1 pr-3 text-sm font-medium text-slate-700 transition duration-200 hover:bg-slate-50"
              >
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-indigo-100 text-xs font-semibold text-indigo-700">
                  {user.name.slice(0, 1).toUpperCase()}
                </span>
                <span className="hidden sm:inline">{user.name.split(" ")[0]}</span>
                {user.is_admin ? <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">ADMIN</span> : null}
              </Link>
              <form action={logoutAction}>
                <button className="text-sm font-medium text-slate-500 transition hover:text-slate-900">Sign out</button>
              </form>
            </>
          ) : (
            <>
              <Link href="/login" className="text-sm font-medium text-slate-600 transition hover:text-slate-900">
                Log in
              </Link>
              <Link
                href="/register"
                className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white transition duration-200 hover:bg-indigo-700"
              >
                Sign up
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

export function MobileNav({ user }: { user: { name: string; is_admin: number } | null }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);

  const links = [
    ...LINKS,
    ...(user?.is_admin ? [{ href: "/admin", label: "Review", icon: ShieldCheck }] : []),
    { href: "/compare", label: "Compare", icon: null },
    { href: "/profile", label: user ? "Profile" : "Log in", icon: null },
  ];

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <button
          type="button"
          aria-label="Open menu"
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white/60 text-slate-600 transition duration-200 hover:border-indigo-300 hover:text-slate-900 md:hidden"
        >
          <Menu className="h-4.5 w-4.5" />
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="palette-overlay fixed inset-0 z-[60] bg-slate-950/40 backdrop-blur-sm md:hidden" />
        <Dialog.Content
          className="nav-sheet fixed inset-y-0 right-0 z-[61] flex w-72 max-w-[85vw] flex-col bg-white p-5 shadow-2xl md:hidden"
          onInteractOutside={() => setOpen(false)}
        >
          <Dialog.Title className="sr-only">Menu</Dialog.Title>
          <Dialog.Description className="sr-only">Site navigation</Dialog.Description>
          <div className="mb-4 flex items-center justify-between">
            <span className="flex items-center gap-2 font-semibold text-slate-900">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 text-white">
                <Boxes className="h-4 w-4" />
              </span>
              AgentHub
            </span>
            <Dialog.Close asChild>
              <button type="button" aria-label="Close menu" className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700">
                <X className="h-4 w-4" />
              </button>
            </Dialog.Close>
          </div>
          <nav className="flex flex-col gap-1 text-sm">
            {links.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                onClick={() => setOpen(false)}
                className={`flex items-center gap-2.5 rounded-lg px-3 py-2.5 font-medium transition duration-200 ${
                  isActive(l.href) ? "bg-indigo-50 text-indigo-700" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                }`}
              >
                {l.icon && <l.icon className="h-4 w-4" />}
                {l.label}
              </Link>
            ))}
          </nav>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
