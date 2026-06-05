import { cookies } from "next/headers";

const API_BASE_URL =
  process.env.BACKEND_INTERNAL_URL ||
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  "http://localhost:4100";

export async function fetchCloudShield<T>(path: string): Promise<T | null> {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get("cloudshield_session")?.value;

    if (!sessionCookie) {
      return null;
    }

    const response = await fetch(`${API_BASE_URL}${path}`, {
      cache: "no-store",
      headers: {
        Cookie: `cloudshield_session=${sessionCookie}`
      }
    });

    if (!response.ok) {
      return null;
    }

    return (await response.json()) as T;
  } catch {
    return null;
  }
}

export async function fetchCurrentUser(): Promise<{
  user: { email: string; name: string | null; role: string; organizationId: string };
  organization: { name: string; slug: string; id: string };
} | null> {
  return fetchCloudShield("/api/v1/auth/me");
}
