import { useState, type SubmitEvent } from "react";
import "./InputBar.css";

interface InputBarProps {
  hasMovies: boolean;
  graphRevision: number;
  onSearch: (query: string) => void;
}

const MAX_QUERY_LENGTH = 4_000;

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
  const [isLoading, setIsLoading] = useState(false);
  const [agentMessage, setAgentMessage] = useState("");
  const [expandedRevision, setExpandedRevision] = useState<number | null>(null);
  const isExpanded = !hasMovies || expandedRevision === graphRevision;

  const handleSubmit = async (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    const search = query.trim();
    if (!search || search.length > MAX_QUERY_LENGTH || isLoading) return;

    onSearch(search);
    setIsLoading(true);
    setAgentMessage("Consultando al agente CuradorGrafo...");

    try {
      const response = await fetch("/api/agente", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: search, source: "search_bar" }),
      });
      const data: unknown = await response.json();

      if (
        !response.ok ||
        !data ||
        typeof data !== "object" ||
        !("ok" in data) ||
        data.ok !== true
      ) {
        const errorMessage =
          data &&
          typeof data === "object" &&
          "error" in data &&
          typeof data.error === "string"
            ? data.error
            : "Error al ejecutar el agente.";
        throw new Error(errorMessage);
      }

      if (!("mensaje" in data) || typeof data.mensaje !== "string") {
        throw new Error("El agente devolvió una respuesta inválida.");
      }

      setAgentMessage(data.mensaje);
      setQuery("");
      if (hasMovies) setExpandedRevision(null);
    } catch (error) {
      console.error("Error invocando al agente:", error);
      setAgentMessage("Ocurrió un error al procesar tu solicitud.");
    } finally {
      setIsLoading(false);
    }
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
      <div className="input-bar-content">
        <form className="input-bar-form" onSubmit={handleSubmit}>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            maxLength={MAX_QUERY_LENGTH}
            placeholder="Ej: Recomendar a partir de Matrix..."
            aria-label="Buscar recomendaciones de películas"
            disabled={isLoading}
          />
          {query.length > 0 && (
            <button
              type="button"
              className="input-bar-clear"
              aria-label="Borrar búsqueda"
              onClick={() => setQuery("")}
              disabled={isLoading}
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
            aria-label={isLoading ? "Procesando búsqueda" : "Buscar"}
            disabled={!query.trim() || isLoading}
          >
            {isLoading ? "..." : <SearchIcon />}
          </button>
        </form>
        {agentMessage && (
          <p className="input-bar-message" aria-live="polite">
            {agentMessage}
          </p>
        )}
      </div>
      {hasMovies && (
        <button
          type="button"
          className="input-bar-collapse"
          aria-label="Contraer búsqueda"
          aria-expanded={true}
          disabled={isLoading}
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
