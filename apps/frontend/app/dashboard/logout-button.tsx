"use client";

import { useRouter } from "next/navigation";
import { fetchCloudShieldClient, clearCsrfToken } from "../../lib/client-api";

export function LogoutButton() {
  const router = useRouter();

  async function logout() {
    try {
      await fetchCloudShieldClient("/api/v1/auth/logout", { method: "POST" });
    } catch (e) {
      // ignore
    }
    clearCsrfToken();
    router.replace("/login");
    router.refresh();
  }

  return (
    <button
      className="cs-button-secondary"
      onClick={logout}
      type="button"
    >
      Logout
    </button>
  );
}
