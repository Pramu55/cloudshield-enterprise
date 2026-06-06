"use client";

import { useEffect, useRef, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Search, Loader2, File, AlertTriangle, CheckCircle, ShieldAlert, ArrowRight, X } from "lucide-react";
import { GlobalSearchResponse, GlobalSearchGroup, GlobalSearchResult } from "@cloudshield/contracts";
import { fetchCloudShieldClient } from "../../lib/client-api";

interface GlobalSearchDialogProps {
  open: boolean;
  onClose: () => void;
}

function ResultIcon({ type }: { type: string }) {
  switch (type) {
    case "awsAccount": return <CheckCircle size={14} className="text-emerald-500" />;
    case "finding": return <ShieldAlert size={14} className="text-amber-500" />;
    case "resource": return <File size={14} className="text-blue-500" />;
    case "team": return <ArrowRight size={14} className="text-indigo-400" />;
    case "member": return <ArrowRight size={14} className="text-indigo-400" />;
    default: return <File size={14} className="text-slate-400" />;
  }
}

export function GlobalSearchDialog({ open, onClose }: GlobalSearchDialogProps) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<GlobalSearchResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [selectedIndex, setSelectedIndex] = useState(0);

  // Recent searches stored in localStorage
  const [recent, setRecent] = useState<{ id: string; title: string; href: string; type: string }[]>([]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("cloudshield.search.recent");
      if (saved) setRecent(JSON.parse(saved));
    } catch {}
  }, []);

  const saveRecent = (item: GlobalSearchResult) => {
    const next = [
      { id: item.id, title: item.title, href: item.href, type: item.type },
      ...recent.filter(r => r.id !== item.id)
    ].slice(0, 5);
    setRecent(next);
    localStorage.setItem("cloudshield.search.recent", JSON.stringify(next));
  };

  useEffect(() => {
    if (open) {
      setQuery("");
      setResponse(null);
      setError(null);
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  // Debounce and fetch
  useEffect(() => {
    if (!open) return;

    if (query.trim().length < 2) {
      setResponse(null);
      setLoading(false);
      return;
    }

    const abortController = new AbortController();
    setLoading(true);
    setError(null);

    const timer = setTimeout(async () => {
      try {
        const res = (await fetchCloudShieldClient(`/api/v1/search?q=${encodeURIComponent(query.trim())}`, {
          signal: abortController.signal
        } as any)) as Response;
        const data = await res.json();
        setResponse(data);
        setSelectedIndex(0);
      } catch (err: any) {
        if (err.name !== "AbortError") {
          setError(err.message || "Failed to search");
        }
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => {
      clearTimeout(timer);
      abortController.abort();
    };
  }, [query, open]);

  // Flatten results for keyboard navigation
  const flatResults = useMemo(() => {
    if (!response) return [];
    return response.groups.flatMap(g => g.results);
  }, [response]);

  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        if (open) onClose();
      }
      if (e.key === "Escape" && open) {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", handleGlobalKeyDown);
    return () => window.removeEventListener("keydown", handleGlobalKeyDown);
  }, [open, onClose]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex(i => Math.min(i + 1, flatResults.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex(i => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (flatResults.length > 0 && selectedIndex >= 0) {
        const item = flatResults[selectedIndex];
        if (item) {
          saveRecent(item);
          router.push(item.href);
          onClose();
        }
      }
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[10vh] bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div
        ref={containerRef}
        className="w-full max-w-2xl bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[80vh]"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center px-4 py-3 border-b border-slate-100 dark:border-slate-800">
          <Search size={18} className="text-slate-400" />
          <input
            ref={inputRef}
            className="flex-1 bg-transparent border-none outline-none px-3 text-slate-900 dark:text-slate-100 placeholder-slate-400"
            placeholder="Search resources, accounts, findings..."
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          {loading && <Loader2 size={16} className="text-slate-400 animate-spin mr-2" />}
          <button className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 p-2">
          {error && (
            <div className="p-4 text-center text-red-500 text-sm flex flex-col items-center">
              <AlertTriangle size={24} className="mb-2" />
              {error}
            </div>
          )}

          {!query && recent.length > 0 && (
            <div className="px-2 py-1">
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 mt-2 px-2">Recent Searches</div>
              {recent.map((item, i) => (
                <button
                  key={i}
                  className="w-full flex items-center px-3 py-2 text-sm rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 text-left text-slate-700 dark:text-slate-300 transition-colors"
                  onClick={() => {
                    router.push(item.href);
                    onClose();
                  }}
                >
                  <ResultIcon type={item.type} />
                  <span className="ml-3 truncate">{item.title}</span>
                </button>
              ))}
            </div>
          )}

          {query && !loading && flatResults.length === 0 && !error && (
            <div className="p-8 text-center text-slate-500 text-sm">
              No results found for "{query}"
            </div>
          )}

          {response && response.groups.map(group => {
            if (group.results.length === 0) return null;
            return (
              <div key={group.type} className="mb-4 last:mb-0">
                <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 mt-2 px-4">
                  {group.label}
                </div>
                <div>
                  {group.results.map((item) => {
                    const idx = flatResults.findIndex(r => r.id === item.id && r.type === item.type);
                    const isSelected = idx === selectedIndex;
                    return (
                      <button
                        key={`${item.type}-${item.id}`}
                        className={`w-full flex items-center px-4 py-2.5 text-sm text-left transition-colors ${
                          isSelected ? "bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-300" : "text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/50"
                        }`}
                        onClick={() => {
                          saveRecent(item);
                          router.push(item.href);
                          onClose();
                        }}
                        onMouseEnter={() => setSelectedIndex(idx)}
                      >
                        <div className="flex-shrink-0 w-6 flex justify-center">
                          <ResultIcon type={item.type} />
                        </div>
                        <div className="ml-2 flex-1 min-w-0 flex flex-col justify-center">
                          <div className="truncate font-medium">{item.title}</div>
                          {item.subtitle && <div className={`truncate text-xs ${isSelected ? 'text-indigo-500/70 dark:text-indigo-400/70' : 'text-slate-500 dark:text-slate-400'}`}>{item.subtitle}</div>}
                        </div>
                        {item.status && (
                          <div className={`ml-4 flex-shrink-0 text-xs px-2 py-0.5 rounded-full border ${isSelected ? 'border-indigo-200 dark:border-indigo-800 bg-indigo-100/50 dark:bg-indigo-900/50' : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800'}`}>
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

        <div className="px-4 py-2 border-t border-slate-100 dark:border-slate-800 text-xs text-slate-500 flex justify-between bg-slate-50 dark:bg-slate-900/50">
          <div className="flex gap-4">
            <span className="flex items-center gap-1"><kbd className="bg-slate-200 dark:bg-slate-700 px-1 rounded">â†‘â†“</kbd> to navigate</span>
            <span className="flex items-center gap-1"><kbd className="bg-slate-200 dark:bg-slate-700 px-1 rounded">Enter</kbd> to select</span>
            <span className="flex items-center gap-1"><kbd className="bg-slate-200 dark:bg-slate-700 px-1 rounded">Esc</kbd> to close</span>
          </div>
        </div>
      </div>
    </div>
  );
}
