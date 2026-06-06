"use client";

import { useEffect, useRef, useState, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Search, Loader2, X, Command } from "lucide-react";
import { GlobalSearchResponse, GlobalSearchResult } from "@cloudshield/contracts";
import { fetchCloudShieldClient } from "../../lib/client-api";
import { GlobalSearchDropdown } from "./GlobalSearchDropdown";

interface SearchRecentItem {
  id: string;
  title: string;
  href: string;
  type: string;
}

export function GlobalSearchBar() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [response, setResponse] = useState<GlobalSearchResponse | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [recent, setRecent] = useState<SearchRecentItem[]>([]);

  // Load recent from local storage
  useEffect(() => {
    try {
      const saved = localStorage.getItem("cloudshield.search.recent");
      if (saved) setRecent(JSON.parse(saved));
    } catch {}
  }, []);

  const saveRecent = useCallback((item: GlobalSearchResult | SearchRecentItem) => {
    setRecent(prev => {
      const next = [
        { id: item.id, title: item.title, href: item.href, type: item.type },
        ...prev.filter(r => r.id !== item.id)
      ].slice(0, 5);
      localStorage.setItem("cloudshield.search.recent", JSON.stringify(next));
      return next;
    });
  }, []);

  const clearRecent = useCallback(() => {
    setRecent([]);
    localStorage.removeItem("cloudshield.search.recent");
  }, []);

  const flatResults = useMemo(() => {
    if (!response || response.query !== query) return [];
    return response.groups.flatMap(g => g.results);
  }, [response, query]);

  // Handle global shortcuts
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        inputRef.current?.focus();
        setOpen(true);
      }
    };
    window.addEventListener("keydown", handleGlobalKeyDown);
    return () => window.removeEventListener("keydown", handleGlobalKeyDown);
  }, []);

  // Handle click outside to close
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Fetch logic
  useEffect(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    if (!open) return;

    if (query.trim().length < 2) {
      setLoading(false);
      setError(null);
      setSelectedIndex(0);
      return;
    }

    setLoading(true);
    setError(null);
    const controller = new AbortController();
    abortControllerRef.current = controller;

    debounceTimerRef.current = setTimeout(async () => {
      try {
        const data = await fetchCloudShieldClient<GlobalSearchResponse>(
          `/api/v1/search?q=${encodeURIComponent(query.trim())}`,
          { signal: controller.signal }
        );
        
        // Stale protection
        if (!controller.signal.aborted) {
          setResponse(data);
          setSelectedIndex(0);
          setError(null);
        }
      } catch (err: any) {
        if (err instanceof DOMException && err.name === "AbortError") {
          return;
        }
        if (err.name === "AbortError") {
          return;
        }
        setError(err.message || "Failed to search");
        console.error("Search API Error:", err);
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }, 300);

    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      if (abortControllerRef.current) abortControllerRef.current.abort();
    };
  }, [query, open]);

  const handleSelectResult = (item: GlobalSearchResult | SearchRecentItem) => {
    saveRecent(item);
    setOpen(false);
    router.push(item.href);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!open) {
      if (e.key === "Enter" || e.key === "ArrowDown") {
        setOpen(true);
      }
      return;
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!query && recent.length > 0) {
        setSelectedIndex(i => Math.min(i + 1, recent.length - 1));
      } else {
        setSelectedIndex(i => Math.min(i + 1, flatResults.length - 1));
      }
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex(i => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (!query && recent.length > 0 && selectedIndex >= 0) {
        const item = recent[selectedIndex];
        if (item) handleSelectResult(item);
      } else if (flatResults.length > 0 && selectedIndex >= 0) {
        const item = flatResults[selectedIndex];
        if (item) handleSelectResult(item);
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      if (query) {
        setQuery("");
      } else {
        setOpen(false);
        inputRef.current?.blur();
      }
    }
  };

  const activeDescendant = open && flatResults.length > 0 ? `search-result-${selectedIndex}` : undefined;

  return (
    <div 
      ref={wrapperRef} 
      className="relative flex-1 max-w-[680px] w-full mx-4 hidden sm:block z-50"
    >
      <div 
        className={`relative flex items-center w-full h-9 bg-slate-100/80 dark:bg-slate-900/50 border transition-all duration-200 rounded-md overflow-hidden ${
          open 
            ? "border-cyan-500/50 dark:border-cyan-500/50 ring-1 ring-cyan-500/20 shadow-sm bg-white dark:bg-slate-900" 
            : "border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 hover:bg-slate-200/50 dark:hover:bg-slate-800/50"
        }`}
      >
        <div className="pl-3 pr-2 flex items-center justify-center text-slate-400 dark:text-slate-500">
          <Search size={16} />
        </div>
        
        <input
          ref={inputRef}
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-controls="search-results-listbox"
          aria-autocomplete="list"
          aria-activedescendant={activeDescendant}
          className="flex-1 w-full bg-transparent border-none outline-none text-sm text-slate-900 dark:text-slate-100 placeholder-slate-500 dark:placeholder-slate-400 py-1.5"
          placeholder="Search accounts, resources, findings, scans, reports, teams…"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            if (!open) setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          spellCheck={false}
        />

        <div className="pr-2 flex items-center space-x-1">
          {loading && <Loader2 size={14} className="text-cyan-500 animate-spin mr-1" />}
          
          {query && !loading && (
            <button 
              type="button" 
              onClick={() => {
                setQuery("");
                inputRef.current?.focus();
              }}
              className="p-1 rounded text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
              aria-label="Clear search"
            >
              <X size={14} />
            </button>
          )}

          {!query && !open && (
            <kbd className="hidden lg:flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-medium text-slate-400 dark:text-slate-500 border border-slate-200 dark:border-slate-800 rounded bg-white dark:bg-slate-950">
              <Command size={10} />K
            </kbd>
          )}
        </div>
      </div>

      {open && (
        <div className="absolute top-[calc(100%+8px)] left-0 right-0 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md shadow-xl overflow-hidden max-h-[70vh] flex flex-col animate-in fade-in slide-in-from-top-2 duration-200 origin-top">
          <div className="overflow-y-auto overscroll-contain flex-1 custom-scrollbar">
            <GlobalSearchDropdown
              query={query}
              loading={loading}
              error={error}
              response={response}
              recent={recent}
              selectedIndex={selectedIndex}
              flatResults={flatResults}
              onSelectResult={handleSelectResult}
              onHoverResult={setSelectedIndex}
              onRetry={() => {
                setError(null);
                setQuery(query + " "); // Trigger a refetch
                setTimeout(() => setQuery(q => q.trim()), 10);
              }}
              onClearRecent={clearRecent}
            />
          </div>
        </div>
      )}
    </div>
  );
}
