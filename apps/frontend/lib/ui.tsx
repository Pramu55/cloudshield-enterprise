import Link from "next/link";

export function SampleDataNotice() {
  return (
    <div className="mb-5 rounded-md border border-warning/40 bg-white px-4 py-3 text-sm font-medium text-ink">
      Sample demo data - real AWS inventory scanning is not enabled yet.
    </div>
  );
}

export function EmptyState({ label }: { label: string }) {
  return (
    <div className="rounded-md border border-line bg-white p-5 text-sm text-slate-600">
      {label}
      <div className="mt-4">
        <Link className="text-sm font-semibold text-signal" href="/login">
          Please log in
        </Link>
      </div>
    </div>
  );
}
