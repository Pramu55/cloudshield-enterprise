"use client";

import { useEffect, useRef, useState, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Search, Loader2, X, Command } from "lucide-react";
import { GlobalSearchResponse, GlobalSearchResult } from "@cloudshield/contracts";
import { fetchCloudShieldClient } from "../../lib/client-api";
import { GlobalSearchDropdown } from "./GlobalSearchDropdown";
import { ROUTE_REGISTRY } from "../../lib/route-registry";

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

  const staticAliases = useMemo(() => {
    if (!query || query.trim().length < 2) return [];
    const qLower = query.toLowerCase();

    const ALIASES = ROUTE_REGISTRY.map(item => ({
      id: item.id,
      type: "alias",
      title: item.label,
      subtitle: `Platform > ${item.category}`,
      href: item.href,
      keywords: [item.label.toLowerCase(), item.category.toLowerCase(), ...(item.keywords || [])]
    }));

    return ALIASES.filter(a => a.keywords.some(k => k.includes(qLower)) || a.title.toLowerCase().includes(qLower));
  }, [query]);

  const enhancedResponse = useMemo(() => {
    if (!response || response.query !== query) {
      if (loading) return null;
      if (staticAliases.length > 0) {
        return {
          query,
          total: staticAliases.length,
          generatedAt: new Date().toISOString(),
          groups: [{ type: "navigation", label: "Quick Navigation", results: staticAliases, hasMore: false }]
        } as unknown as GlobalSearchResponse;
      }
      return null;
    }

    if (staticAliases.length === 0) return response;

    return {
      ...response,
      total: response.total + staticAliases.length,
      groups: [
        { type: "navigation", label: "Quick Navigation", results: staticAliases, hasMore: false },
        ...response.groups
      ]
    } as unknown as GlobalSearchResponse;
  }, [response, query, staticAliases, loading]);

  const flatResults = useMemo(() => {
    if (!enhancedResponse) return [];
    return enhancedResponse.groups.flatMap(g => g.results);
  }, [enhancedResponse]);

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
        className={`relative flex items-center w-full h-10 border transition-all duration-200 rounded-md overflow-hidden bg-white shadow-sm ${
          open
            ? "border-blue-500 ring-1 ring-blue-500/20"
            : "border-slate-200 hover:border-slate-300"
        }`}
      >
        <div className="pl-3 pr-2 flex items-center justify-center text-slate-700">
          <Search size={16} />
        </div>

        <input
          id="global-search-input"
          ref={inputRef}
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-controls="search-results-listbox"
          aria-autocomplete="list"
          aria-activedescendant={activeDescendant}
          className="flex-1 w-full bg-transparent border-none outline-none text-sm text-slate-900 placeholder-slate-500 py-2"
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
              className="p-1 rounded text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors"
              aria-label="Clear search"
            >
              <X size={14} />
            </button>
          )}

          {!query && !open && (
            <kbd className="hidden lg:flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-medium text-slate-500 border border-slate-200 rounded bg-white">
              <Command size={10} />K
            </kbd>
          )}
        </div>
      </div>

      {open && (
        <div className="absolute top-[calc(100%+8px)] left-0 right-0 bg-white border border-slate-200 rounded-md shadow-xl overflow-hidden max-h-[70vh] flex flex-col animate-in fade-in slide-in-from-top-2 duration-200 origin-top">

...          <div className="overflow-y-auto overscroll-contain flex-1 custom-scrollbar">
            <GlobalSearchDropdown
              query={query}
              loading={loading}
              error={error}
              response={enhancedResponse}
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
