"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useCloudShieldData, fetchCloudShieldClient, mutateCloudShieldData } from "../../../lib/client-api";
import { Save, Loader2, CheckCircle2, AlertCircle, Shield, Cloud, Settings, Building, Lock, User } from "lucide-react";

type TabType = "personal" | "security" | "workspace";

export default function ProfilePage() {
  const { data, isRefreshing: loading, error: fetchError } = useCloudShieldData<any>("/api/v1/auth/me", null);
  
  const [activeTab, setActiveTab] = useState<TabType>("personal");
  const [name, setName] = useState("");
  const [isInitialized, setIsInitialized] = useState(false);
  
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    if (data?.user && !isInitialized) {
      setName(data.user.name || "");
      setIsInitialized(true);
    }
  }, [data, isInitialized]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    
    setIsSaving(true);
    setSaveError(null);
    setSaveSuccess(false);

    try {
      await fetchCloudShieldClient("/api/v1/auth/profile", {
        method: "PATCH",
        body: JSON.stringify({ name: name.trim() })
      });
      setSaveSuccess(true);
      
      // Tell the layout to refetch auth/me and update global state
      mutateCloudShieldData("/api/v1/auth/me");

      // Reset success message after 3 seconds
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err: any) {
      setSaveError(err.message || "Failed to update profile.");
    } finally {
      setIsSaving(false);
    }
  };

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center min-h-[50vh] text-slate-400">
        <Loader2 className="animate-spin w-8 h-8" />
      </div>
    );
  }

  if (fetchError || !data || !data.user) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-red-500">
        <AlertCircle className="w-12 h-12 mb-4" />
        <h2 className="text-xl font-bold">Failed to load profile</h2>
      </div>
    );
  }

  const user = data.user;
  const org = data.organization;
  const initials = (user.name || user.email).substring(0, 2).toUpperCase();
  const hasChanges = name.trim() !== (user.name || "");

  // Calculate completeness based on available fields
  let fieldsCount = 0;
  let filledCount = 0;
  
  fieldsCount++; if (user.name?.trim()) filledCount++;
  fieldsCount++; if (user.email?.trim()) filledCount++;
  fieldsCount++; if (org?.name?.trim()) filledCount++;
  fieldsCount++; if (user.role?.trim()) filledCount++;

  const completenessPercentage = Math.round((filledCount / fieldsCount) * 100);

  return (
    <div className="w-full pb-12 animate-in fade-in duration-300">
      {/* Banner */}
      <div className="w-full h-[140px] sm:h-[180px] md:h-[240px] bg-gradient-to-r from-slate-900 via-[#0e172a] to-blue-900 relative overflow-hidden">
        {/* Subtle pattern / glow */}
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyMCIgaGVpZ2h0PSIyMCI+CjxyZWN0IHdpZHRoPSIyMCIgaGVpZ2h0PSIyMCIgZmlsbD0ibm9uZSIvPgo8Y2lyY2xlIGN4PSIxIiBjeT0iMSIgcj0iMSIgZmlsbD0icmdiYSgyNTUsMjU1LDI1NSwwLjA1KSIvPgo8L3N2Zz4=')]"></div>
        <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-blue-500/20 rounded-full blur-[100px] mix-blend-screen transform -translate-y-1/2"></div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 -mt-16 md:-mt-24 relative z-10 flex flex-col md:flex-row gap-6 md:gap-8 items-start">
        
        {/* Left Column */}
        <div className="w-full md:w-[320px] shrink-0 flex flex-col gap-6">
          
          {/* Profile Summary Card */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sm:p-8 flex flex-col items-center text-center">
            <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center text-white text-3xl sm:text-4xl font-bold shadow-lg shadow-blue-500/20 mb-5 border-4 border-white shrink-0">
              {initials}
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 mb-1 tracking-tight">{user.name || "User"}</h1>
            <p className="text-sm text-slate-500 mb-4">{user.email}</p>
            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-700 shadow-sm">
               <Building size={12} className="text-slate-400" />
               <span className="truncate max-w-[140px]">{org?.name || "Unknown"}</span>
               <span className="text-slate-300 px-0.5">•</span>
               <span>{user.role === "admin" ? "Owner" : (user.role || "Viewer")}</span>
            </div>
          </div>

          {/* Completeness Card */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sm:p-8">
            <h3 className="text-sm font-bold text-slate-900 mb-4">Profile Completeness</h3>
            <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden mb-3">
               <div 
                 className="h-full bg-emerald-500 rounded-full transition-all duration-1000 ease-out" 
                 style={{ width: `${completenessPercentage}%` }}
                 role="progressbar" 
                 aria-valuenow={completenessPercentage} 
                 aria-valuemin={0} 
                 aria-valuemax={100}
               ></div>
            </div>
            <p className="text-xs font-bold text-slate-700 mb-2">{completenessPercentage}% complete</p>
            <p className="text-xs text-slate-500 leading-relaxed">
              Profile completeness is based on the account information currently supported by CloudShield.
            </p>
          </div>

        </div>

        {/* Right Column (Tabs & Forms) */}
        <div className="w-full flex-1 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col md:mt-16">
          
          <div className="flex w-full overflow-x-auto border-b border-slate-200 no-scrollbar" role="tablist">
            <button 
              role="tab" 
              aria-selected={activeTab === "personal"} 
              onClick={() => setActiveTab("personal")}
              className={`flex items-center gap-2 px-6 py-4 text-sm font-bold border-b-2 whitespace-nowrap transition-colors outline-none focus-visible:bg-slate-50 ${activeTab === "personal" ? "border-blue-600 text-blue-700" : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"}`}
            >
              <User size={16} /> Personal details
            </button>
            <button 
              role="tab" 
              aria-selected={activeTab === "security"} 
              onClick={() => setActiveTab("security")}
              className={`flex items-center gap-2 px-6 py-4 text-sm font-bold border-b-2 whitespace-nowrap transition-colors outline-none focus-visible:bg-slate-50 ${activeTab === "security" ? "border-blue-600 text-blue-700" : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"}`}
            >
              <Lock size={16} /> Security
            </button>
            <button 
              role="tab" 
              aria-selected={activeTab === "workspace"} 
              onClick={() => setActiveTab("workspace")}
              className={`flex items-center gap-2 px-6 py-4 text-sm font-bold border-b-2 whitespace-nowrap transition-colors outline-none focus-visible:bg-slate-50 ${activeTab === "workspace" ? "border-blue-600 text-blue-700" : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"}`}
            >
              <Building size={16} /> Workspace access
            </button>
          </div>

          <div className="p-6 md:p-8">
            {activeTab === "personal" && (
              <div role="tabpanel" className="animate-in fade-in duration-200">
                <div className="mb-6">
                  <h3 className="text-lg font-bold text-slate-900 mb-1">Personal details</h3>
                  <p className="text-sm text-slate-500">Manage your basic profile information.</p>
                </div>
                
                <form onSubmit={handleSave} className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700">Display name</label>
                    <input 
                      type="text" 
                      value={name} 
                      onChange={(e) => setName(e.target.value)} 
                      disabled={isSaving} 
                      maxLength={80}
                      className="w-full h-10 px-3 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 disabled:bg-slate-50 transition-all"
                      placeholder="Enter your display name"
                    />
                    <p className="text-xs text-slate-500">This is the name that will be displayed across the platform.</p>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700">Email address</label>
                    <div className="h-10 px-3 bg-slate-50 border border-slate-200 rounded-lg flex items-center text-sm text-slate-500 select-none">
                      {user.email}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-slate-700">Workspace</label>
                      <div className="h-10 px-3 bg-slate-50 border border-slate-200 rounded-lg flex items-center text-sm text-slate-600 select-none">
                        {org?.name || "Unknown"}
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-slate-700">Role</label>
                      <div className="h-10 px-3 bg-slate-50 border border-slate-200 rounded-lg flex items-center text-sm text-slate-600 select-none uppercase text-xs font-bold tracking-wider">
                        {user.role}
                      </div>
                    </div>
                  </div>
                  
                  <div className="pt-8 mt-8 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div className="flex-1 w-full flex items-center">
                       {saveSuccess && (
                         <div className="flex items-center gap-2 text-sm text-emerald-600 font-bold bg-emerald-50 px-3 py-1.5 rounded-md" role="status">
                           <CheckCircle2 size={16} /> Profile updated successfully
                         </div>
                       )}
                       {saveError && (
                         <div className="flex items-center gap-2 text-sm text-red-600 font-bold bg-red-50 px-3 py-1.5 rounded-md" role="alert">
                           <AlertCircle size={16} /> {saveError}
                         </div>
                       )}
                    </div>
                    <button 
                      type="submit" 
                      disabled={!hasChanges || isSaving || !name.trim()} 
                      className="w-full sm:w-auto h-10 px-6 rounded-lg font-bold text-sm bg-blue-600 text-white hover:bg-blue-700 disabled:bg-slate-200 disabled:text-slate-400 transition-all flex items-center justify-center gap-2 shrink-0"
                    >
                      {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                      Save Changes
                    </button>
                  </div>
                </form>
              </div>
            )}

            {activeTab === "security" && (
              <div role="tabpanel" className="animate-in fade-in duration-200">
                <div className="mb-6">
                  <h3 className="text-lg font-bold text-slate-900 mb-1">Security</h3>
                  <p className="text-sm text-slate-500">Account security and authentication settings.</p>
                </div>

                <div className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700">Account email</label>
                    <div className="h-10 px-3 bg-slate-50 border border-slate-200 rounded-lg flex items-center text-sm text-slate-600 select-none">
                      {user.email}
                    </div>
                  </div>

                  <div className="mt-8 bg-blue-50/50 border border-blue-100 rounded-xl p-5 md:p-6 flex items-start gap-4">
                    <Shield className="text-blue-600 shrink-0 mt-0.5" size={24} />
                    <div>
                       <h4 className="text-sm font-bold text-slate-900 mb-1.5">Centralized Security Management</h4>
                       <p className="text-sm text-slate-600 leading-relaxed">
                         Password and advanced session controls are managed through the authenticated CloudShield account system and are not currently editable from this page.
                       </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === "workspace" && (
              <div role="tabpanel" className="animate-in fade-in duration-200">
                <div className="mb-6">
                  <h3 className="text-lg font-bold text-slate-900 mb-1">Workspace access</h3>
                  <p className="text-sm text-slate-500">Your current workspace context and permissions.</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
                   <div className="bg-slate-50 border border-slate-200 rounded-xl p-5">
                     <span className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Organization</span>
                     <span className="block text-sm font-bold text-slate-900 truncate">{org?.name || "Unknown"}</span>
                   </div>
                   <div className="bg-slate-50 border border-slate-200 rounded-xl p-5">
                     <span className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Assigned Role</span>
                     <span className="block text-sm font-bold text-slate-900 uppercase tracking-wider">{user.role}</span>
                   </div>
                   <div className="bg-slate-50 border border-slate-200 rounded-xl p-5">
                     <span className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Membership Status</span>
                     <span className="inline-flex items-center gap-2 text-sm font-bold text-emerald-600">
                       <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]"></div> Active
                     </span>
                   </div>
                   <div className="bg-slate-50 border border-slate-200 rounded-xl p-5">
                     <span className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Data Mode</span>
                     <span className="block text-sm font-bold text-slate-900">Tenant-isolated</span>
                   </div>
                </div>

                <div className="space-y-4 pt-4 border-t border-slate-100">
                  <h4 className="text-sm font-bold text-slate-900">Workspace Actions</h4>
                  <div className="flex flex-col sm:flex-row gap-3">
                    <Link href="/dashboard/accounts" className="flex items-center justify-center gap-2 h-10 px-5 rounded-lg bg-white border border-slate-200 text-sm font-bold text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition-colors shadow-sm">
                       <Cloud size={16} className="text-slate-400" /> Manage AWS accounts
                    </Link>
                    <Link href="/dashboard/settings" className="flex items-center justify-center gap-2 h-10 px-5 rounded-lg bg-white border border-slate-200 text-sm font-bold text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition-colors shadow-sm">
                       <Settings size={16} className="text-slate-400" /> Workspace settings
                    </Link>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
