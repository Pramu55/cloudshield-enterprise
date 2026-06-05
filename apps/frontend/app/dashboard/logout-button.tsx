"use client";

import { useRouter } from "next/navigation";
import { fetchCloudShieldClient } from "../../lib/client-api";

export function LogoutButton() {
  const router = useRouter();

  async function logout() {
    try {
      await fetchCloudShieldClient("/api/v1/auth/logout", { method: "POST" });
    } catch (e) {
      // ignore
    }
    localStorage.removeItem("cloudshield_current_user");
    router.replace("/login");
    router.refresh();
  }

  return (
    <button
      className="rounded-md border border-line px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-panel"
      onClick={logout}
      type="button"
    >
      Logout
    </button>
  );
}
