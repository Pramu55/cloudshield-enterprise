"use client";

import { useRouter } from "next/navigation";

export function LogoutButton() {
  const router = useRouter();

  function logout() {
    localStorage.removeItem("cloudshield_access_token");
    localStorage.removeItem("cloudshield_current_user");
    document.cookie = "cloudshield_access_token=; path=/; max-age=0; SameSite=Lax";
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
