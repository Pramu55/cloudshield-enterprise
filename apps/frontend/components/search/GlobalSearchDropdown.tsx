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
      <div className="p-6 text-center flex flex-col items-center border-t border-slate-100 dark:border-slate-800">
        <AlertTriangle size={24} className="mb-2 text-amber-500" />
        <div className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
          Search is temporarily unavailable.
        </div>
        <div className="text-xs text-slate-500 mb-3">Please try again.</div>
        {onRetry && (
          <button
            onClick={onRetry}
            type="button"
            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-medium rounded transition-colors"
          >
            Retry
          </button>
        )}
      </div>
    );
  }

  // 2. Empty Query - Recent Searches
  if (!query) {
    if (recent.length === 0) {
      return (
        <div className="p-4 border-t border-slate-100 dark:border-slate-800">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 px-2">Suggested Destinations</div>
          <button onClick={() => onSelectResult({ id: "aws", title: "AWS Accounts", href: "/dashboard/accounts", type: "awsAccount" })} className="w-full flex items-center px-3 py-2 text-sm rounded-md hover:bg-slate-50 dark:hover:bg-slate-800/50 text-left text-slate-700 dark:text-slate-300 transition-colors">
            <ResultIcon type="awsAccount" />
            <span className="ml-3 truncate font-medium">AWS Accounts</span>
          </button>
          <button onClick={() => onSelectResult({ id: "inv", title: "Inventory", href: "/dashboard/inventory", type: "resource" })} className="w-full flex items-center px-3 py-2 text-sm rounded-md hover:bg-slate-50 dark:hover:bg-slate-800/50 text-left text-slate-700 dark:text-slate-300 transition-colors">
            <ResultIcon type="resource" />
            <span className="ml-3 truncate font-medium">Inventory</span>
          </button>
          <button onClick={() => onSelectResult({ id: "sec", title: "Findings", href: "/dashboard/security", type: "finding" })} className="w-full flex items-center px-3 py-2 text-sm rounded-md hover:bg-slate-50 dark:hover:bg-slate-800/50 text-left text-slate-700 dark:text-slate-300 transition-colors">
            <ResultIcon type="finding" />
            <span className="ml-3 truncate font-medium">Findings</span>
          </button>
        </div>
      );
    }

    return (
      <div className="p-2 border-t border-slate-100 dark:border-slate-800">
        <div className="flex items-center justify-between px-2 py-1 mb-1 mt-1">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Recent Searches</div>
          {onClearRecent && (
            <button onClick={onClearRecent} className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
              Clear
            </button>
          )}
        </div>
        {recent.map((item, i) => (
          <button
            key={i}
            className="w-full flex items-center px-3 py-2 text-sm rounded-md hover:bg-slate-50 dark:hover:bg-slate-800/50 text-left text-slate-700 dark:text-slate-300 transition-colors"
            onMouseDown={(e) => {
              e.preventDefault();
              onSelectResult(item);
            }}
          >
            <ResultIcon type={item.type} />
            <span className="ml-3 truncate font-medium">{item.title}</span>
          </button>
        ))}
      </div>
    );
  }

  // 3. Loading state
  if (loading && (!response || response.query !== query)) {
    return (
      <div className="p-4 border-t border-slate-100 dark:border-slate-800">
        <div className="animate-pulse space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center space-x-3 px-2">
              <div className="w-4 h-4 bg-slate-200 dark:bg-slate-800 rounded-full"></div>
              <div className="flex-1 space-y-2">
                <div className="h-3 bg-slate-200 dark:bg-slate-800 rounded w-1/3"></div>
                <div className="h-2 bg-slate-200 dark:bg-slate-800 rounded w-1/2"></div>
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
      <div className="p-8 text-center border-t border-slate-100 dark:border-slate-800">
        <div className="text-sm text-slate-700 dark:text-slate-300 mb-1">
          No CloudShield records match "{query}".
        </div>
        <div className="text-xs text-slate-500">
          Try checking IDs, names, regions, or resource types.
        </div>
      </div>
    );
  }

  // 5. Results
  return (
    <div className="p-2 border-t border-slate-100 dark:border-slate-800" role="listbox" id="search-results-listbox">
      {response?.groups.map(group => {
        if (group.results.length === 0) return null;
        return (
          <div key={group.type} className="mb-4 last:mb-0">
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 mt-2 px-3">
              {group.label}
            </div>
            <div>
              {group.results.map((item) => {
                const idx = flatResults.findIndex(r => r.id === item.id && r.type === item.type);
                const isSelected = idx === selectedIndex;
                return (
                  <button
                    key={`${item.type}-${item.id}`}
                    id={`search-result-${idx}`}
                    role="option"
                    aria-selected={isSelected}
                    className={`w-full flex items-center px-3 py-2.5 text-sm rounded-md text-left transition-colors ${
                      isSelected ? "bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-300" : "text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/50"
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
                    <div className="ml-2 flex-1 min-w-0 flex flex-col justify-center">
                      <div className="truncate font-medium">{item.title}</div>
                      {item.subtitle && <div className={`truncate text-xs ${isSelected ? 'text-indigo-500/80 dark:text-indigo-400/80' : 'text-slate-500 dark:text-slate-400'}`}>{item.subtitle}</div>}
                    </div>
                    {item.status && (
                      <div className={`ml-4 flex-shrink-0 text-[10px] px-2 py-0.5 rounded-full border uppercase tracking-wider font-semibold ${isSelected ? 'border-indigo-200 dark:border-indigo-800 bg-indigo-100/50 dark:bg-indigo-900/50' : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50'}`}>
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
