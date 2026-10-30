import { LoginForm } from "@/components/auth-forms";

export default function LoginPage() {
  return (
    <div className="mx-auto max-w-sm py-10">
      <h1 className="mb-1 text-center text-2xl font-bold text-slate-900">Welcome back</h1>
      <p className="mb-6 text-center text-sm text-slate-500">Sign in to AgentHub</p>
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <LoginForm />
      </div>
      <div className="mt-4 rounded-xl border border-dashed border-slate-300 bg-slate-100/60 p-4 text-xs text-slate-500">
        <p className="font-semibold text-slate-600">Demo accounts</p>
        <p className="mt-1 font-mono">admin@acme.dev / admin123 (admin)</p>
        <p className="font-mono">alice@acme.dev / password123</p>
      </div>
    </div>
  );
}
