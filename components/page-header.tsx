export function PageHeader({
  eyebrow,
  title,
  subtitle,
  actions,
}: {
  eyebrow?: string;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div>
        {eyebrow && (
          <p className="enter text-[11px] font-semibold uppercase tracking-widest text-indigo-500" style={{ ["--i" as string]: 0 }}>
            {eyebrow}
          </p>
        )}
        <h1 className="enter mt-1 text-2xl font-bold tracking-tight text-slate-900" style={{ ["--i" as string]: 1 }}>
          {title}
        </h1>
        {subtitle && (
          <p className="enter mt-1 max-w-2xl text-sm text-slate-500" style={{ ["--i" as string]: 2 }}>
            {subtitle}
          </p>
        )}
      </div>
      {actions && (
        <div className="enter flex items-center gap-2" style={{ ["--i" as string]: 3 }}>
          {actions}
        </div>
      )}
    </div>
  );
}
