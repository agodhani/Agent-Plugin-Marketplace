import Link from "next/link";
import { Boxes, Heart, ListChecks, ShieldCheck, Upload, Users } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { logoutAction } from "@/lib/actions";

export async function Navbar() {
  const user = await getCurrentUser();
  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/80 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-5 px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2 font-semibold text-slate-900">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-600 text-white">
            <Boxes className="h-4 w-4" />
          </span>
          AgentHub
          <span className="hidden rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-500 sm:inline">
            internal
          </span>
        </Link>
        <nav className="flex flex-1 items-center gap-1 text-sm">
          <Link href="/" className="rounded-md px-3 py-1.5 font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900">
            Browse
          </Link>
          <Link href="/playbooks" className="flex items-center gap-1.5 rounded-md px-3 py-1.5 font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900">
            <ListChecks className="h-3.5 w-3.5" /> Playbooks
          </Link>
          <Link href="/submit" className="flex items-center gap-1.5 rounded-md px-3 py-1.5 font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900">
            <Upload className="h-3.5 w-3.5" /> Submit
          </Link>
          <Link href="/favorites" className="flex items-center gap-1.5 rounded-md px-3 py-1.5 font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900">
            <Heart className="h-3.5 w-3.5" /> Favorites
          </Link>
          <Link href="/teams" className="flex items-center gap-1.5 rounded-md px-3 py-1.5 font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900">
            <Users className="h-3.5 w-3.5" /> Teams
          </Link>
          {user?.is_admin ? (
            <Link href="/admin" className="flex items-center gap-1.5 rounded-md px-3 py-1.5 font-medium text-indigo-600 hover:bg-indigo-50">
              <ShieldCheck className="h-3.5 w-3.5" /> Review
            </Link>
          ) : null}
        </nav>
        <div className="flex items-center gap-3">
          {user ? (
            <>
              <Link
                href="/profile"
                className="flex items-center gap-2 rounded-full border border-slate-200 py-1 pl-1 pr-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-indigo-100 text-xs font-semibold text-indigo-700">
                  {user.name.slice(0, 1).toUpperCase()}
                </span>
                {user.name.split(" ")[0]}
                {user.is_admin ? <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">ADMIN</span> : null}
              </Link>
              <form action={logoutAction}>
                <button className="text-sm font-medium text-slate-500 hover:text-slate-900">Sign out</button>
              </form>
            </>
          ) : (
            <>
              <Link href="/login" className="text-sm font-medium text-slate-600 hover:text-slate-900">
                Log in
              </Link>
              <Link
                href="/register"
                className="rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700"
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
