import type { MouseEvent } from "react";
import { Handle, Position, type NodeProps } from "reactflow";
import type { WatchlistItem } from "../data/interfaces";

export interface MovieNodeData {
  title: string;
  poster: string;
  description?: string;
  genres?: string[];
}

interface MovieCardNodeProps extends NodeProps<MovieNodeData> {
  watchlist: WatchlistItem[];
  watchlistReady: boolean;
  onToggleWatchlist: (
    movie: WatchlistItem,
    status: WatchlistItem["status"] | null,
  ) => void;
}

export const MovieCardNode = ({
  id,
  data,
  watchlist,
  watchlistReady,
  onToggleWatchlist,
}: MovieCardNodeProps) => {
  const watchlistMovie = watchlist.find((item) => item.id === String(id));
  const status = watchlistMovie ? (watchlistMovie.status ?? "pending") : null;

  const handleCycleWatchlistStatus = (
    event: MouseEvent<HTMLButtonElement>,
  ) => {
    event.stopPropagation();

    const movie: WatchlistItem = {
      id: String(id),
      title: data.title,
      poster: data.poster,
      genres: data.genres ?? [],
    };

    const nextStatus =
      status === null
        ? "pending"
        : status === "pending"
          ? "completed"
          : null;
    onToggleWatchlist(movie, nextStatus);
  };

  const statusLabel =
    status === "pending"
      ? "Pendiente. Marcar como vista"
      : status === "completed"
        ? "Vista. Quitar de la watchlist"
        : "No está en la watchlist. Agregar como pendiente";

  return (
    <div
      style={{
        width: 310,
        minHeight: 500,
        background: "linear-gradient(180deg, #1f2937 0%, #111827 100%)",
        border: "1px solid rgba(148, 163, 184, 0.3)",
        borderRadius: 18,
        boxShadow: "0 12px 28px rgba(15, 23, 42, 0.42)",
        padding: "16px 16px 14px",
        color: "#f8fafc",
        display: "flex",
        flexDirection: "column",
        gap: 14,
        boxSizing: "border-box",
        overflow: "hidden",
        position: "relative",
      }}
    >
      <button
        type="button"
        disabled={!watchlistReady}
        aria-label={statusLabel}
        title={statusLabel}
        className="nodrag nopan"
        onMouseDown={(e) => {
          e.preventDefault();
          e.stopPropagation();
        }}
        onPointerDown={(e) => {
          e.preventDefault();
          e.stopPropagation();
        }}
        onPointerDownCapture={(e) => {
          e.preventDefault();
          e.stopPropagation();
        }}
        onClick={handleCycleWatchlistStatus}
        style={{
          position: "absolute",
          top: 10,
          right: 10,
          width: 30,
          height: 30,
          borderRadius: "50%",
          border: `1px solid ${
            status === "completed"
              ? "rgba(34, 197, 94, 0.5)"
              : status === "pending"
                ? "rgba(250, 204, 21, 0.5)"
                : "rgba(148, 163, 184, 0.5)"
          }`,
          background:
            status === "completed"
              ? "rgba(34, 197, 94, 0.16)"
              : status === "pending"
                ? "rgba(250, 204, 21, 0.16)"
                : "rgba(15, 23, 42, 0.7)",
          color:
            status === "completed"
              ? "#4ade80"
              : status === "pending"
                ? "#facc15"
                : "#94a3b8",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
          boxShadow: "0 0 0 1px rgba(148, 163, 184, 0.12)",
          zIndex: 1,
          pointerEvents: "auto",
        }}
      >
        {status === "pending" ? (
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            width="18"
            height="18"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="9" />
            <path d="M12 7v5l3 2" />
          </svg>
        ) : status === "completed" ? (
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            width="18"
            height="18"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="9" />
            <path d="m8 12 2.5 2.5L16 9" />
          </svg>
        ) : (
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            width="18"
            height="18"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M4 8h16v12H4z" />
            <path d="m4 8 2-5h16l-2 5M9 3l3 5m2-5 3 5" />
          </svg>
        )}
      </button>

      <Handle
        type="target"
        position={Position.Top}
        style={{
          background: "#38bdf8",
          border: "none",
          width: 10,
          height: 10,
          top: -5,
        }}
      />
      <Handle
        type="source"
        position={Position.Bottom}
        style={{
          background: "#38bdf8",
          border: "none",
          width: 10,
          height: 10,
          bottom: -5,
        }}
      />

      <div
        style={{
          width: "100%",
          height: 250,
          borderRadius: 10,
          overflow: "hidden",
          background: "transparent",
          marginBottom: 0,
        }}
      >
        <img
          src={data.poster}
          alt={data.title}
          style={{
            width: "100%",
            height: "100%",
            display: "block",
            objectFit: "contain",
            objectPosition: "center",
            background: "transparent",
          }}
        />
      </div>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 6,
          flex: 1,
          justifyContent: "flex-start",
        }}
      >
        <h3
          style={{
            margin: 0,
            fontSize: "24px",
            fontWeight: 700,
            lineHeight: 1.25,
            color: "#f8fafc",
            wordBreak: "break-word",
            letterSpacing: "0.08px",
          }}
        >
          {data.title}
        </h3>

        {data.description && (
          <p
            style={{
              margin: 0,
              fontSize: "18px",
              lineHeight: 1.5,
              color: "#cbd5e1",
              wordBreak: "break-word",
              display: "-webkit-box",
              WebkitLineClamp: 7,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {data.description}
          </p>
        )}
        {data.genres && data.genres.length > 0 && (
          <div
            style={{
              display: "flex",
              gap: "6px",
              flexWrap: "wrap",
              justifyContent: "center",
              alignItems: "center",
              marginBottom: "4px",
              width: "100%",
            }}
          >
            {data.genres.map((genre, idx) => (
              <span
                key={idx}
                style={{
                  background: "rgba(56, 189, 248, 0.15)",
                  color: "#7dd3fc",
                  padding: "2px 10px",
                  borderRadius: "12px",
                  fontSize: "11px",
                  fontWeight: 600,
                  border: "1px solid rgba(56, 189, 248, 0.3)",
                  letterSpacing: "0.5px",
                }}
              >
                {genre.toUpperCase()}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
