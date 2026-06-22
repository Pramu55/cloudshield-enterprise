import React from "react";
import Link from "next/link";
import { useCloudShieldData } from "../../lib/client-api";
import { Bell, AlertTriangle, Info, CheckCircle, Clock } from "lucide-react";
import { NotificationListResponse, NotificationDto } from "@cloudshield/contracts";
import { formatDate } from "../../app/dashboard/shared";

export function NotificationFeed() {
  const { data, error, isRefreshing } = useCloudShieldData<NotificationListResponse>("/api/v1/notifications", { items: [] });

  const notifications = data?.items || [];

  const getIcon = (severity: NotificationDto["severity"]) => {
    switch (severity) {
      case "CRITICAL":
      case "HIGH":
        return <AlertTriangle size={16} className="text-red-500" />;
      case "MEDIUM":
        return <AlertTriangle size={16} className="text-orange-500" />;
      case "LOW":
        return <Info size={16} className="text-blue-500" />;
      default:
        return <Info size={16} className="text-slate-500" />;
    }
  };

  return (
    <div className="portal-popover portal-notifications absolute top-14 right-10 w-[24rem] max-h-[32rem] overflow-y-auto bg-white border border-slate-200 shadow-2xl rounded-2xl z-50 flex flex-col">
      <div className="px-5 py-4 border-b border-slate-100 font-bold flex justify-between items-center bg-white sticky top-0 z-10">
        <span className="text-slate-900">Notifications</span>
        <Link href="/dashboard/monitoring" className="text-xs font-bold text-blue-600 hover:text-blue-800 px-2 py-1 rounded-lg hover:bg-blue-50 transition-colors">Open monitoring</Link>
      </div>
      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
        {error ? (
          <div className="py-10 px-6 text-center text-sm text-slate-600">
            Notifications are temporarily unavailable. Open Security Monitoring for the authoritative alert view.
          </div>
        ) : isRefreshing && notifications.length === 0 ? (
          <div className="py-10 px-6 text-center text-sm font-semibold text-slate-500">Loading notifications...</div>
        ) : notifications.length === 0 ? (
          <div className="py-12 px-6 text-center text-sm text-slate-500 flex flex-col items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 flex items-center justify-center">
              <CheckCircle size={24} className="text-emerald-500" />
            </div>
            <p className="font-semibold text-slate-900">You're all caught up!</p>
            <p className="text-xs text-slate-400">New alerts and operational updates will appear here.</p>
          </div>
        ) : (
          notifications.map(n => (
            <div key={n.id} className={`text-sm p-4 border rounded-xl flex gap-4 transition-all hover:shadow-sm ${n.read ? 'bg-white border-slate-100 opacity-60' : 'bg-blue-50/50 border-blue-100 shadow-sm'}`}>
              <div className="mt-1 flex-shrink-0">{getIcon(n.severity)}</div>
              <div className="flex-1">
                <strong className={`block mb-1 ${n.read ? 'text-slate-600 font-bold' : 'text-slate-900 font-extrabold'}`}>{n.title}</strong>
                <p className="text-xs text-slate-500 leading-relaxed">{n.message}</p>
                <div className="flex items-center gap-2 mt-3 text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                  <Clock size={10} />
                  {formatDate(n.createdAt)}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
