"use client";

import { useEffect, useRef, useState, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Search, Loader2, X, Command } from "lucide-react";
import { GlobalSearchResponse, GlobalSearchResult } from "@cloudshield/contracts";
import { fetchCloudShieldClient } from "../../lib/client-api";
import { toApiError } from "../../lib/api-error";
import { ROUTE_REGISTRY } from "../../lib/route-registry";
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

  const trimmedQuery = query.trim();
  const routeResults = useMemo<GlobalSearchResult[]>(() => {
    if (!trimmedQuery) return [];
    const normalized = trimmedQuery.toLowerCase();
    return ROUTE_REGISTRY
      .map((route) => {
        const searchable = [route.label, route.category, route.description ?? "", ...route.keywords].map((value) => value.toLowerCase());
        const exact = route.label.toLowerCase() === normalized;
        const prefix = route.label.toLowerCase().startsWith(normalized);
        const keywordMatch = searchable.some((value) => value.includes(normalized));
        return { route, score: exact ? 0 : prefix ? 1 : keywordMatch ? 2 : 99 };
      })
      .filter(({ score }) => score < 99)
      .sort((left, right) => left.score - right.score || left.route.label.localeCompare(right.route.label))
      .slice(0, 8)
      .map(({ route }) => ({
        id: route.id,
        type: "navigation",
        title: route.label,
        subtitle: `${route.category} · ${route.description ?? "CloudShield workspace"}`,
        href: route.href
      }));
  }, [trimmedQuery]);

  const enhancedResponse = useMemo<GlobalSearchResponse | null>(() => {
    const backendResponse = response?.query === trimmedQuery ? response : null;
    const backendGroups = backendResponse?.groups.filter((group) => group.type !== "alias" && group.type !== "navigation") ?? [];
    if (!routeResults.length && !backendResponse) return null;
    return {
      query: trimmedQuery,
      generatedAt: backendResponse?.generatedAt ?? new Date().toISOString(),
      total: routeResults.length + backendGroups.reduce((total, group) => total + group.results.length, 0),
      groups: [
        ...(routeResults.length ? [{
          type: "navigation" as const,
          label: "Platform modules",
          results: routeResults,
          hasMore: false
        }] : []),
        ...backendGroups
      ]
    };
  }, [response, routeResults, trimmedQuery]);

  const flatResults = useMemo(() => enhancedResponse?.groups.flatMap((group) => group.results) ?? [], [enhancedResponse]);

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

    if (trimmedQuery.length < 2) {
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
          `/api/v1/search?q=${encodeURIComponent(trimmedQuery)}`,
          { signal: controller.signal }
        );

        // Stale protection
        if (!controller.signal.aborted) {
          setResponse(data);
          setSelectedIndex(0);
          setError(null);
        }
      } catch (err: unknown) {
        if (err instanceof DOMException && err.name === "AbortError") {
          return;
        }
        const normalized = toApiError(err);
        if (normalized.kind === "CANCELLED") return;
        setError(normalized.safeMessage);
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
  }, [trimmedQuery, open]);

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
      className="global-search relative flex-1 max-w-[680px] w-full mx-4 hidden sm:block z-50"
    >
      <div
        className={`global-search-field relative flex items-center w-full h-10 border transition-all duration-200 rounded-lg overflow-hidden bg-white ${
          open
            ? "border-blue-500 ring-2 ring-blue-500/15 shadow-md"
            : "border-slate-300 hover:border-slate-400 shadow-sm"
        }`}
      >
        <div className="pl-3 pr-2 flex items-center justify-center text-slate-700">
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
          className="flex-1 w-full bg-transparent border-none outline-none text-sm font-medium text-slate-950 placeholder:text-slate-600 py-2"
          placeholder="Search accounts, resources, findings, monitoring, teams..."
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
              className="p-1 rounded text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors"
              aria-label="Clear search"
            >
              <X size={14} />
            </button>
          )}

          {!query && !open && (
            <kbd className="hidden lg:flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600 border border-slate-300 rounded bg-slate-50">
              <Command size={10} />K
            </kbd>
          )}
        </div>
      </div>

      {open && (
        <div className="global-search-dropdown absolute top-[calc(100%+8px)] left-0 right-0 bg-white border border-slate-200 rounded-xl shadow-2xl overflow-hidden max-h-[70vh] flex flex-col animate-in fade-in slide-in-from-top-2 duration-200 origin-top">
          <div className="overflow-y-auto overscroll-contain flex-1 custom-scrollbar">
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
