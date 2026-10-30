import { redirect } from "next/navigation";
import { ClipboardCheck, FileSearch, Rocket, ScanSearch } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { SubmitForm } from "@/components/submit-form";

export default async function SubmitPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const steps = [
    { icon: FileSearch, title: "Validation", text: "Manifest, README and archive hygiene checks" },
    { icon: ScanSearch, title: "Security scan", text: "Static analysis for exec, network, secrets & filesystem use" },
    { icon: ClipboardCheck, title: "Admin review", text: "A reviewer approves or rejects with notes" },
    { icon: Rocket, title: "Published", text: "Listed in the catalog with an audit trail" },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Submit to the catalog</h1>
        <p className="mt-1 text-sm text-slate-500">
          Share a skill, MCP server, plugin or doc with the company. Every submission goes through this pipeline:
        </p>
      </div>
      <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {steps.map((s, i) => (
          <li key={s.title} className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
                <s.icon className="h-4 w-4" />
              </span>
              <span className="text-xs font-bold text-slate-400">STEP {i + 1}</span>
            </div>
            <p className="mt-2 text-sm font-semibold text-slate-800">{s.title}</p>
            <p className="mt-0.5 text-xs leading-relaxed text-slate-500">{s.text}</p>
          </li>
        ))}
      </ol>
      <SubmitForm />
    </div>
  );
}
