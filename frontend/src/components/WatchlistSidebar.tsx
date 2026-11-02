import { useState } from "react";
import type { WatchlistItem } from "./MovieCardNode";
import "./WatchlistSidebar.css";

interface Props {
  watchlist: WatchlistItem[];
  isLoaded: boolean;
  watchlistError: string | null;
  sortedWatchlist: WatchlistItem[];
  pendingWatchlist: WatchlistItem[];
  completedWatchlist: WatchlistItem[];
  watchlistSort: "asc" | "desc";
  setWatchlistSort: React.Dispatch<React.SetStateAction<"asc" | "desc">>;
  availableGenres: string[];
  selectedGenre: string;
  setSelectedGenre: React.Dispatch<React.SetStateAction<string>>;
  toggleMovieStatus: (movieId: string) => void;
}

export const WatchlistSidebar = ({
  watchlist,
  isLoaded,
  watchlistError,
  sortedWatchlist,
  pendingWatchlist,
  completedWatchlist,
  watchlistSort,
  setWatchlistSort,
  availableGenres,
  selectedGenre,
  setSelectedGenre,
  toggleMovieStatus,
}: Props) => {
  const [isExpanded, setIsExpanded] = useState(true);

  return (
    <div className="watchlist-dock">
      {isExpanded && (
        <aside id="watchlist-panel" className="watchlist-panel">
          <div className="watchlist-panel-header">
            <button
              type="button"
              className="watchlist-collapse"
              aria-label="Contraer watchlist"
              aria-expanded={true}
              aria-controls="watchlist-panel"
              onClick={() => setIsExpanded(false)}
            >
              <svg
                aria-hidden="true"
                viewBox="0 0 24 24"
                width="18"
                height="18"
                fill="none"
              >
                <path
                  d="m14 6-6 6 6 6"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
            <h4
              style={{
                margin: 0,
                fontSize: 18,
                fontWeight: 700,
                color: "#f8fafc",
              }}
            >
              Favoritas
            </h4>
            <span className="watchlist-panel-count">{watchlist.length}</span>
          </div>

      {watchlistError && (
        <p role="alert" style={{ color: "#fca5a5", fontSize: 12 }}>
          No se pudo sincronizar la watchlist: {watchlistError}
        </p>
      )}

      {!isLoaded && !watchlistError && (
        <p style={{ color: "#cbd5e1", fontSize: 12 }}>
          Cargando watchlist...
        </p>
      )}

      <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
        <button
          type="button"
          onClick={() =>
            setWatchlistSort((current) => (current === "asc" ? "desc" : "asc"))
          }
          style={{
            flex: 1,
            border: "1px solid rgba(148, 163, 184, 0.25)",
            background: "rgba(56, 189, 248, 0.18)",
            color: "#f8fafc",
            borderRadius: 8,
            padding: "6px 8px",
            cursor: "pointer",
            fontWeight: 600,
            fontSize: 12,
          }}
        >
          {watchlistSort === "asc" ? "A–Z" : "Z–A"}
        </button>
      </div>

      {availableGenres.length > 0 && (
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 8,
            marginBottom: 14,
          }}
        >
          <button
            type="button"
            onClick={() => setSelectedGenre("all")}
            style={{
              border: "1px solid rgba(148, 163, 184, 0.25)",
              background:
                selectedGenre === "all"
                  ? "rgba(250, 204, 21, 0.18)"
                  : "rgba(15, 23, 42, 0.8)",
              color: "#f8fafc",
              borderRadius: 999,
              padding: "5px 10px",
              cursor: "pointer",
              fontWeight: 700,
              fontSize: 11,
            }}
          >
            Todas
          </button>
          {availableGenres.map((genre) => (
            <button
              key={genre}
              type="button"
              onClick={() => setSelectedGenre(genre)}
              style={{
                border: "1px solid rgba(148, 163, 184, 0.25)",
                background:
                  selectedGenre === genre
                    ? "rgba(56, 189, 248, 0.18)"
                    : "rgba(15, 23, 42, 0.8)",
                color: selectedGenre === genre ? "#7dd3fc" : "#e2e8f0",
                borderRadius: 999,
                padding: "5px 10px",
                cursor: "pointer",
                fontWeight: 700,
                fontSize: 11,
                textTransform: "uppercase",
              }}
            >
              {genre}
            </button>
          ))}
        </div>
      )}

      {watchlist.length === 0 ? (
        <p
          style={{ margin: 0, color: "#cbd5e1", fontSize: 14, lineHeight: 1.5 }}
        >
          No hay películas guardadas todavía.
        </p>
      ) : sortedWatchlist.length === 0 ? (
        <p
          style={{ margin: 0, color: "#cbd5e1", fontSize: 14, lineHeight: 1.5 }}
        >
          No hay películas para este género.
        </p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <h5
              style={{
                margin: "0 0 8px",
                color: "#f8fafc",
                fontSize: 13,
                fontWeight: 700,
              }}
            >
              Pendientes
            </h5>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {pendingWatchlist.map((movie) => (
                <div
                  key={movie.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    background: "rgba(30, 41, 59, 0.8)",
                    border: "1px solid rgba(100, 116, 139, 0.35)",
                    borderRadius: 12,
                    padding: 8,
                  }}
                >
                  <img
                    src={movie.poster}
                    alt={movie.title}
                    style={{
                      width: 42,
                      height: 60,
                      objectFit: "cover",
                      borderRadius: 8,
                      flexShrink: 0,
                    }}
                  />
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "flex-start",
                      gap: 2,
                      flex: 1,
                    }}
                  >
                    <span
                      style={{
                        color: "#f8fafc",
                        fontSize: 13,
                        fontWeight: 600,
                        lineHeight: 1.3,
                        wordBreak: "break-word",
                      }}
                    >
                      {movie.title}
                    </span>
                  </div>
                  <button
                    type="button"
                    disabled={!isLoaded}
                    onClick={() => toggleMovieStatus(movie.id)}
                    style={{
                      border: "1px solid rgba(34, 197, 94, 0.4)",
                      background: "rgba(34, 197, 94, 0.12)",
                      color: "#86efac",
                      borderRadius: 999,
                      width: 26,
                      height: 26,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      cursor: "pointer",
                      fontSize: 13,
                      fontWeight: 700,
                    }}
                  >
                    ✓
                  </button>
                </div>
              ))}
            </div>
          </div>
          <div>
            <h5
              style={{
                margin: "0 0 8px",
                color: "#f8fafc",
                fontSize: 13,
                fontWeight: 700,
              }}
            >
              Vistas
            </h5>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {completedWatchlist.map((movie) => (
                <div
                  key={movie.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    background: "rgba(22, 101, 52, 0.25)",
                    border: "1px solid rgba(34, 197, 94, 0.35)",
                    borderRadius: 12,
                    padding: 8,
                  }}
                >
                  <img
                    src={movie.poster}
                    alt={movie.title}
                    style={{
                      width: 42,
                      height: 60,
                      objectFit: "cover",
                      borderRadius: 8,
                      flexShrink: 0,
                    }}
                  />
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "flex-start",
                      gap: 2,
                      flex: 1,
                    }}
                  >
                    <span
                      style={{
                        color: "#f8fafc",
                        fontSize: 13,
                        fontWeight: 600,
                        lineHeight: 1.3,
                        wordBreak: "break-word",
                      }}
                    >
                      {movie.title}
                    </span>
                  </div>
                  <button
                    type="button"
                    disabled={!isLoaded}
                    onClick={() => toggleMovieStatus(movie.id)}
                    style={{
                      border: "1px solid rgba(239, 68, 68, 0.4)",
                      background: "rgba(239, 68, 68, 0.12)",
                      color: "#fca5a5",
                      borderRadius: 999,
                      width: 26,
                      height: 26,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      cursor: "pointer",
                      fontSize: 14,
                      fontWeight: 700,
                    }}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
        </aside>
      )}
      {!isExpanded && (
        <button
          type="button"
          className="watchlist-toggle"
          aria-label={`Expandir watchlist (${watchlist.length} películas)`}
          aria-expanded={false}
          aria-controls="watchlist-panel"
          onClick={() => setIsExpanded(true)}
        >
          <span aria-hidden="true">★</span>
          <span className="watchlist-toggle-count">{watchlist.length}</span>
        </button>
      )}
    </div>
  );
};
