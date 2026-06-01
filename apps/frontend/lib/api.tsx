const API_BASE_URL =
  process.env.BACKEND_INTERNAL_URL ||
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  "http://localhost:4100";

export async function fetchCloudShield<T>(path: string): Promise<T | null> {
  try {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      cache: "no-store"
    });

    if (!response.ok) {
      return null;
    }

    return (await response.json()) as T;
  } catch {
    return null;
  }
}

export function SampleDataNotice() {
  return (
    <div className="mb-5 rounded-md border border-warning/40 bg-white px-4 py-3 text-sm font-medium text-ink">
      Sample demo data - real AWS scanning is not enabled yet.
    </div>
  );
}

export function EmptyState({ label }: { label: string }) {
  return (
    <div className="rounded-md border border-line bg-white p-5 text-sm text-slate-600">
      {label}
    </div>
  );
}
