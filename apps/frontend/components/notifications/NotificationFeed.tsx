import React from "react";
import { useCloudShieldData } from "../../lib/client-api";
import { Bell, AlertTriangle, Info, CheckCircle, Clock } from "lucide-react";

type Notification = {
  id: string;
  title: string;
  message: string;
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "INFO";
  createdAt: string;
  read: boolean;
};

export function NotificationFeed() {
  const { data, error, isRefreshing } = useCloudShieldData<{ notifications: Notification[] }>("/api/v1/notifications", { notifications: [] });

  const notifications = data?.notifications || [];

  const getIcon = (severity: string) => {
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
    <div className="portal-popover portal-notifications absolute top-12 right-10 w-80 max-h-[28rem] overflow-y-auto bg-white border border-slate-200 shadow-xl rounded-md z-50 flex flex-col">
      <div className="p-3 border-b border-slate-100 font-semibold flex justify-between items-center bg-slate-50 sticky top-0">
        <span>Notifications</span>
        <button className="text-xs text-blue-600 hover:text-blue-800">Mark all read</button>
      </div>
      <div className="flex-1 overflow-y-auto p-2 flex flex-col gap-2">
        {notifications.length === 0 ? (
          <div className="p-4 text-center text-sm text-slate-500 flex flex-col items-center gap-2">
            <CheckCircle size={24} className="text-emerald-500" />
            <p>You're all caught up!</p>
          </div>
        ) : (
          notifications.map(n => (
            <div key={n.id} className={`text-sm p-3 border rounded flex gap-3 ${n.read ? 'bg-white border-slate-100 opacity-70' : 'bg-blue-50 border-blue-100'}`}>
              <div className="mt-0.5">{getIcon(n.severity)}</div>
              <div className="flex-1">
                <strong className="text-slate-800 block mb-0.5">{n.title}</strong>
                <p className="text-xs text-slate-600 leading-relaxed">{n.message}</p>
                <div className="flex items-center gap-1 mt-2 text-[10px] text-slate-400 font-mono">
                  <Clock size={10} />
                  {new Date(n.createdAt).toLocaleDateString()} {new Date(n.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
