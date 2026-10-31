import { RegisterForm } from "@/components/auth-forms";
import { AuthBrandCompact, AuthBrandPanel } from "@/components/auth-brand";

export default function RegisterPage() {
  return (
    <div className="grid items-stretch gap-8 py-6 md:grid-cols-[1.1fr_1fr]">
      <AuthBrandPanel />
      <div className="mx-auto w-full max-w-sm self-center">
        <AuthBrandCompact />
        <h2 className="mb-1 text-center text-2xl font-bold text-slate-900">Create an account</h2>
        <p className="mb-6 text-center text-sm text-slate-500">Join your company&apos;s agent marketplace</p>
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <RegisterForm />
        </div>
      </div>
    </div>
  );
}
