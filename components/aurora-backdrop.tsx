/** Ambient background layers shared by the hero and the auth brand panel. */
export function AuroraBackdrop() {
  return (
    <>
      <div aria-hidden className="aurora aurora-a absolute -left-24 -top-28 h-96 w-96 rounded-full bg-indigo-600/45 blur-3xl" />
      <div aria-hidden className="aurora aurora-b absolute -right-16 top-1/4 h-80 w-80 rounded-full bg-fuchsia-600/35 blur-3xl" />
      <div aria-hidden className="aurora aurora-c absolute -bottom-24 left-1/3 h-72 w-72 rounded-full bg-sky-500/35 blur-3xl" />
      <div aria-hidden className="hero-grid absolute inset-0" />
      <div aria-hidden className="hero-noise absolute inset-0 opacity-[0.05]" />
    </>
  );
}
