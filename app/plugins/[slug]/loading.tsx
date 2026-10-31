export default function Loading() {
  return (
    <div className="space-y-6" aria-label="Loading">
      {/* header band */}
      <div className="skeleton h-32 rounded-2xl" />
      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-4">
          <div className="skeleton h-9 w-2/3 rounded-lg" />
          <div className="skeleton h-72 rounded-2xl" />
        </div>
        <div className="space-y-4">
          <div className="skeleton h-20 rounded-2xl" />
          <div className="skeleton h-44 rounded-2xl" />
          <div className="skeleton h-28 rounded-2xl" />
        </div>
      </div>
    </div>
  );
}
