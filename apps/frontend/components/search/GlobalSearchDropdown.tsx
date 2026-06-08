"use client";

import { CheckCircle, ShieldAlert, File, ArrowRight, AlertTriangle } from "lucide-react";
import { GlobalSearchResponse, GlobalSearchResult } from "@cloudshield/contracts";

interface SearchRecentItem {
  id: string;
  title: string;
  href: string;
  type: string;
}

interface GlobalSearchDropdownProps {
  query: string;
  loading: boolean;
  error: string | null;
  response: GlobalSearchResponse | null;
  recent: SearchRecentItem[];
  selectedIndex: number;
  flatResults: GlobalSearchResult[];
  onSelectResult: (item: GlobalSearchResult | SearchRecentItem) => void;
  onHoverResult: (index: number) => void;
  onRetry?: () => void;
  onClearRecent?: () => void;
}

function ResultIcon({ type }: { type: string }) {
  switch (type) {
    case "awsAccount": return <CheckCircle size={14} className="text-emerald-500" />;
    case "finding": return <ShieldAlert size={14} className="text-amber-500" />;
    case "resource": return <File size={14} className="text-blue-500" />;
    case "team":
    case "member": return <ArrowRight size={14} className="text-indigo-400" />;
    case "alias": return <ArrowRight size={14} className="text-cyan-500" />;
    default: return <File size={14} className="text-slate-400" />;
  }
}

export function GlobalSearchDropdown({
  query,
  loading,
  error,
  response,
  recent,
  selectedIndex,
  flatResults,
  onSelectResult,
  onHoverResult,
  onRetry,
  onClearRecent
}: GlobalSearchDropdownProps) {
  // 1. Error State
  if (error) {
    return (
      <div className="p-8 text-center flex flex-col items-center border-t border-slate-100">
        <div className="w-12 h-12 rounded-2xl bg-amber-50 flex items-center justify-center mb-4">
          <AlertTriangle size={24} className="text-amber-500" />
        </div>
        <div className="text-sm font-bold text-slate-800 mb-1">
          Search is temporarily unavailable.
        </div>
        <div className="text-xs text-slate-500 mb-6">Please check your connection and try again.</div>
        {onRetry && (
          <button
            onClick={onRetry}
            type="button"
            className="cs-button-secondary"
          >
            Retry search
          </button>
        )}
      </div>
    );
  }

  // 2. Empty Query - Recent Searches
  if (!query) {
    if (recent.length === 0) {
      return (
        <div className="p-5 border-t border-slate-100">
          <div className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.15em] mb-4 px-3">Suggested Destinations</div>
          <div className="grid gap-1">
            <button onClick={() => onSelectResult({ id: "aws", title: "AWS Accounts", href: "/dashboard/accounts", type: "awsAccount" })} className="w-full flex items-center px-4 py-2.5 text-sm rounded-xl hover:bg-slate-50 text-left text-slate-800 transition-all hover:translate-x-1">
              <ResultIcon type="awsAccount" />
              <span className="ml-4 truncate font-semibold">AWS Accounts</span>
            </button>
            <button onClick={() => onSelectResult({ id: "inv", title: "Inventory", href: "/dashboard/inventory", type: "resource" })} className="w-full flex items-center px-4 py-2.5 text-sm rounded-xl hover:bg-slate-50 text-left text-slate-800 transition-all hover:translate-x-1">
              <ResultIcon type="resource" />
              <span className="ml-4 truncate font-semibold">Inventory</span>
            </button>
            <button onClick={() => onSelectResult({ id: "sec", title: "Findings", href: "/dashboard/security", type: "finding" })} className="w-full flex items-center px-4 py-2.5 text-sm rounded-xl hover:bg-slate-50 text-left text-slate-800 transition-all hover:translate-x-1">
              <ResultIcon type="finding" />
              <span className="ml-4 truncate font-semibold">Findings</span>
            </button>
          </div>
        </div>
      );
    }

    return (
      <div className="p-3 border-t border-slate-100">
        <div className="flex items-center justify-between px-3 py-2 mb-2 mt-1">
          <div className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.15em]">Recent Searches</div>
          {onClearRecent && (
            <button onClick={onClearRecent} className="text-xs font-bold text-blue-600 hover:text-blue-800 px-2 py-0.5 rounded hover:bg-blue-50 transition-colors">
              Clear
            </button>
          )}
        </div>
        <div className="grid gap-1">
          {recent.map((item, i) => (
            <button
              key={i}
              className="w-full flex items-center px-4 py-2.5 text-sm rounded-xl hover:bg-slate-50 text-left text-slate-800 transition-all hover:translate-x-1"
              onMouseDown={(e) => {
                e.preventDefault();
                onSelectResult(item);
              }}
            >
              <ResultIcon type={item.type} />
              <span className="ml-4 truncate font-semibold">{item.title}</span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  // 3. Loading state
  if (loading && (!response || response.query !== query)) {
    return (
      <div className="p-5 border-t border-slate-100">
        <div className="animate-pulse space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center space-x-4 px-3">
              <div className="w-5 h-5 bg-slate-100 rounded-full"></div>
              <div className="flex-1 space-y-3">
                <div className="h-3 bg-slate-100 rounded w-1/3"></div>
                <div className="h-2.5 bg-slate-50 rounded w-1/2"></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // 4. No Results
  if (!loading && flatResults.length === 0) {
    return (
      <div className="py-16 px-6 text-center border-t border-slate-100">
        <div className="text-sm font-bold text-slate-800 mb-2">
          No records match "{query}"
        </div>
        <div className="text-xs text-slate-500 max-w-[240px] mx-auto leading-relaxed">
          Try searching for IDs, names, regions, or common resource types like "S3" or "EC2".
        </div>
      </div>
    );
  }

  // 5. Results
  return (
    <div className="p-3 border-t border-slate-100" role="listbox" id="search-results-listbox">
      {response?.groups.map(group => {
        if (group.results.length === 0) return null;
        return (
          <div key={group.type} className="mb-6 last:mb-0">
            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.15em] mb-3 mt-2 px-4">
              {group.label}
            </div>
            <div className="grid gap-1">
              {group.results.map((item) => {
                const idx = flatResults.findIndex(r => r.id === item.id && r.type === item.type);
                const isSelected = idx === selectedIndex;
                return (
                  <button
                    key={`${item.type}-${item.id}`}
                    id={`search-result-${idx}`}
                    role="option"
                    aria-selected={isSelected}
                    className={`w-full flex items-center px-4 py-3 text-sm rounded-xl text-left transition-all ${
                      isSelected ? "bg-indigo-50 text-indigo-700 translate-x-1 shadow-sm ring-1 ring-indigo-200/50" : "text-slate-800 hover:bg-slate-50"
                    }`}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      onSelectResult(item);
                    }}
                    onMouseEnter={() => onHoverResult(idx)}
                  >
                    <div className="flex-shrink-0 w-6 flex justify-center">
                      <ResultIcon type={item.type} />
                    </div>
                    <div className="ml-3 flex-1 min-w-0 flex flex-col justify-center">
                      <div className="truncate font-bold tracking-tight">{item.title}</div>
                      {item.subtitle && <div className={`truncate text-[11px] mt-0.5 ${isSelected ? 'text-indigo-500/80' : 'text-slate-500'}`}>{item.subtitle}</div>}
                    </div>
                    {item.status && (
                      <div className={`ml-4 flex-shrink-0 text-[9px] px-2 py-0.5 rounded-lg border uppercase tracking-widest font-extrabold ${isSelected ? 'border-indigo-200 bg-indigo-100/50' : 'border-slate-200 bg-slate-50'}`}>
                        {item.status}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
