import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import type { WatchlistItem } from "../data/interfaces";

const WATCHLIST_API_URL = "/api/watchlist";

const isWatchlistItem = (value: unknown): value is WatchlistItem =>
  value !== null &&
  typeof value === "object" &&
  "id" in value &&
  typeof value.id === "string" &&
  "title" in value &&
  typeof value.title === "string" &&
  "poster" in value &&
  typeof value.poster === "string" &&
  (!("genres" in value) ||
    value.genres === undefined ||
    (Array.isArray(value.genres) &&
      value.genres.every((genre) => typeof genre === "string"))) &&
  (!("status" in value) ||
    value.status === undefined ||
    value.status === "pending" ||
    value.status === "completed");

const parseWatchlist = (value: unknown): WatchlistItem[] => {
  if (!Array.isArray(value) || !value.every(isWatchlistItem)) {
    throw new Error("El archivo de watchlist tiene un formato inválido.");
  }
  return value;
};

const requestWatchlist = async (): Promise<WatchlistItem[]> => {
  const response = await fetch(WATCHLIST_API_URL);
  if (!response.ok) {
    throw new Error(`No se pudo leer la watchlist (${response.status}).`);
  }
  return parseWatchlist(await response.json());
};

const saveWatchlist = async (items: WatchlistItem[]): Promise<void> => {
  const response = await fetch(WATCHLIST_API_URL, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(items),
  });
  if (!response.ok) {
    throw new Error(`No se pudo guardar la watchlist (${response.status}).`);
  }
};

const errorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : "Error inesperado en la watchlist.";

export const useWatchlist = () => {
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const [watchlistError, setWatchlistError] = useState<string | null>(null);
  const [watchlistSort, setWatchlistSort] = useState<"asc" | "desc">("asc");
  const [selectedGenre, setSelectedGenre] = useState<string>("all");
  const watchlistRef = useRef<WatchlistItem[]>([]);
  const graphNodesRef = useRef<{ id: string }[] | null>(null);
  const writeQueueRef = useRef<Promise<void>>(Promise.resolve());

  const persistWatchlist = useCallback((items: WatchlistItem[]) => {
    const write = writeQueueRef.current.then(() => saveWatchlist(items));
    writeQueueRef.current = write.then(
      () => setWatchlistError(null),
      (error: unknown) => setWatchlistError(errorMessage(error)),
    );
  }, []);

  const replaceWatchlist = useCallback(
    (items: WatchlistItem[], persist = true) => {
      watchlistRef.current = items;
      setWatchlist(items);
      if (persist) persistWatchlist(items);
    },
    [persistWatchlist],
  );

  useEffect(() => {
    let cancelled = false;

    const loadWatchlist = async () => {
      try {
        let items = await requestWatchlist();

        const graphNodes = graphNodesRef.current;
        if (graphNodes) {
          const graphIds = new Set(graphNodes.map((node) => node.id));
          const synced = items.filter((movie) => graphIds.has(movie.id));
          if (synced.length !== items.length) {
            items = synced;
            await saveWatchlist(items);
          }
        }

        if (cancelled) return;
        replaceWatchlist(items, false);
        setIsLoaded(true);
        setWatchlistError(null);
      } catch (error) {
        if (!cancelled) setWatchlistError(errorMessage(error));
      }
    };

    void loadWatchlist();
    return () => {
      cancelled = true;
    };
  }, [replaceWatchlist]);

  const availableGenres = useMemo(() => {
    const unique = new Set<string>();
    watchlist.forEach((movie) => {
      (movie.genres ?? []).forEach((genre) => {
        if (genre) unique.add(genre);
      });
    });
    return Array.from(unique).sort((a, b) => a.localeCompare(b));
  }, [watchlist]);

  const sortedWatchlist = useMemo(() => {
    const copy = [...watchlist];
    copy.sort((a, b) => {
      const comparison = a.title.localeCompare(b.title);
      return watchlistSort === "asc" ? comparison : -comparison;
    });
    if (selectedGenre === "all") return copy;
    return copy.filter((movie) =>
      (movie.genres ?? []).some((genre) => genre === selectedGenre),
    );
  }, [selectedGenre, watchlist, watchlistSort]);

  const pendingWatchlist = useMemo(
    () => sortedWatchlist.filter((movie) => movie.status !== "completed"),
    [sortedWatchlist],
  );

  const completedWatchlist = useMemo(
    () => sortedWatchlist.filter((movie) => movie.status === "completed"),
    [sortedWatchlist],
  );

  const toggleWatchlist = useCallback(
    (movie: WatchlistItem, status: WatchlistItem["status"] | null) => {
      if (!isLoaded) return;
      const current = watchlistRef.current;
      const next =
        status === null
          ? current.filter((item) => item.id !== movie.id)
          : current.some((item) => item.id === movie.id)
            ? current.map((item) =>
                item.id === movie.id ? { ...movie, status } : item,
              )
            : [...current, { ...movie, status }];
      replaceWatchlist(next);
    },
    [isLoaded, replaceWatchlist],
  );

  const toggleMovieStatus = useCallback(
    (movieId: string) => {
      if (!isLoaded) return;
      const next: WatchlistItem[] = watchlistRef.current.map((movie) => {
        if (movie.id !== movieId) return movie;
        const status: WatchlistItem["status"] =
          movie.status === "completed" ? "pending" : "completed";
        return {
          ...movie,
          status,
        };
      });
      replaceWatchlist(next);
    },
    [isLoaded, replaceWatchlist],
  );

  const syncWatchlistWithGraph = useCallback(
    (currentGraphNodes: { id: string }[]) => {
      graphNodesRef.current = currentGraphNodes;
      if (!isLoaded) return;

      const graphIds = new Set(currentGraphNodes.map((node) => node.id));
      const current = watchlistRef.current;
      const synced = current.filter((movie) => graphIds.has(movie.id));
      if (synced.length !== current.length) replaceWatchlist(synced);
    },
    [isLoaded, replaceWatchlist],
  );

  return {
    watchlist,
    isLoaded,
    watchlistError,
    watchlistSort,
    setWatchlistSort,
    selectedGenre,
    setSelectedGenre,
    availableGenres,
    sortedWatchlist,
    pendingWatchlist,
    completedWatchlist,
    toggleWatchlist,
    toggleMovieStatus,
    syncWatchlistWithGraph,
  };
};
