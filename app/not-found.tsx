import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex flex-col items-center py-24 text-center">
      <p className="text-5xl font-bold text-slate-300">404</p>
      <p className="mt-3 font-medium text-slate-700">That page or plugin doesn&apos;t exist.</p>
      <Link href="/" className="mt-5 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700">
        Back to the marketplace
      </Link>
    </div>
  );
}
