import { useState, type SubmitEvent } from "react";
import "./InputBar.css";

interface InputBarProps {
  hasMovies: boolean;
  graphRevision: number;
  onSearch: (query: string) => void;
}

const SearchIcon = () => (
  <svg
    aria-hidden="true"
    viewBox="0 0 24 24"
    width="20"
    height="20"
    fill="none"
  >
    <circle
      cx="10.8"
      cy="10.8"
      r="6.8"
      stroke="currentColor"
      strokeWidth="2"
    />
    <path
      d="m16 16 4.2 4.2"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    />
  </svg>
);

export const InputBar = ({
  hasMovies,
  graphRevision,
  onSearch,
}: InputBarProps) => {
  const [query, setQuery] = useState("");
  const [expandedRevision, setExpandedRevision] = useState<number | null>(null);
  const isExpanded = !hasMovies || expandedRevision === graphRevision;

  const handleSubmit = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    const search = query.trim();
    if (!search) return;

    console.log("Búsqueda ingresada:", search);
    onSearch(search);
    setQuery("");
    if (hasMovies) setExpandedRevision(null);
  };

  if (!isExpanded) {
    return (
      <button
        type="button"
        className="input-bar-bubble"
        aria-label="Expandir búsqueda"
        aria-expanded={false}
        onClick={() => setExpandedRevision(graphRevision)}
      >
        <SearchIcon />
      </button>
    );
  }

  return (
    <div
      className={`input-bar-container${hasMovies ? " input-bar-floating" : ""}`}
    >
      <form className="input-bar-form" onSubmit={handleSubmit}>
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Pide recomendaciones similares de películas..."
          aria-label="Buscar recomendaciones de películas"
        />
        {query.length > 0 && (
          <button
            type="button"
            className="input-bar-clear"
            aria-label="Borrar búsqueda"
            onClick={() => setQuery("")}
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              width="18"
              height="18"
              fill="none"
            >
              <path
                d="m6 6 12 12M18 6 6 18"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </button>
        )}
        <button
          type="submit"
          className="input-bar-submit"
          aria-label="Buscar"
          disabled={!query.trim()}
        >
          <SearchIcon />
        </button>
      </form>
      {hasMovies && (
        <button
          type="button"
          className="input-bar-collapse"
          aria-label="Contraer búsqueda"
          aria-expanded={true}
          onClick={() => {
            setQuery("");
            setExpandedRevision(null);
          }}
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
      )}
    </div>
  );
};
