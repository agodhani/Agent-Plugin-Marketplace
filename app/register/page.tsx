import { RegisterForm } from "@/components/auth-forms";

export default function RegisterPage() {
  return (
    <div className="mx-auto max-w-sm py-10">
      <h1 className="mb-1 text-center text-2xl font-bold text-slate-900">Create an account</h1>
      <p className="mb-6 text-center text-sm text-slate-500">Join your company&apos;s agent marketplace</p>
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <RegisterForm />
      </div>
    </div>
  );
}
