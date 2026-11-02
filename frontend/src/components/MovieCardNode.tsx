import type { MouseEvent } from "react";
import { Handle, Position, type NodeProps } from "reactflow";

export interface MovieNodeData {
  title: string;
  poster: string;
  description?: string;
  genres?: string[];
}

export interface WatchlistItem {
  id: string;
  title: string;
  poster: string;
  genres?: string[];
  status?: "pending" | "completed";
}

interface MovieCardNodeProps extends NodeProps<MovieNodeData> {
  watchlist: WatchlistItem[];
  watchlistReady: boolean;
  onToggleWatchlist: (movie: WatchlistItem) => void;
}

export const MovieCardNode = ({
  id,
  data,
  watchlist,
  watchlistReady,
  onToggleWatchlist,
}: MovieCardNodeProps) => {
  const isFavorite = watchlist.some((item) => item.id === String(id));

  const handleToggleFavorite = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();

    const nextMovie: WatchlistItem = {
      id: String(id),
      title: data.title,
      poster: data.poster,
      genres: data.genres ?? [],
      status: "pending",
    };

    onToggleWatchlist(nextMovie);
  };

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
        aria-label={
          isFavorite ? "Quitar de la watchlist" : "Agregar a la watchlist"
        }
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
        onClick={handleToggleFavorite}
        style={{
          position: "absolute",
          top: 10,
          right: 10,
          width: 30,
          height: 30,
          borderRadius: "50%",
          border: "1px solid rgba(250, 204, 21, 0.5)",
          background: isFavorite
            ? "rgba(250, 204, 21, 0.2)"
            : "rgba(15, 23, 42, 0.7)",
          color: isFavorite ? "#facc15" : "#e2e8f0",
          fontSize: 18,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
          boxShadow: "0 0 0 1px rgba(148, 163, 184, 0.12)",
          zIndex: 1,
          pointerEvents: "auto",
        }}
      >
        {isFavorite ? "★" : "☆"}
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
