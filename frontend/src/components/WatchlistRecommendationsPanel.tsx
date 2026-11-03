import { useState } from "react";
import type { GraphMovie } from "../data/interfaces";
import "./WatchlistSidebar.css";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object";

export interface RecommendationGroup {
  origin: GraphMovie;
  recommendations: Array<GraphMovie & { reason: string }>;
}

interface Props {
  watchedMovieCount: number;
  isGenerating: boolean;
  suggestions: RecommendationGroup[];
  error: string;
  onClose: () => void;
  onRegenerate: () => void;
}

export const WatchlistRecommendationsPanel = ({
  watchedMovieCount,
  isGenerating,
  suggestions,
  error,
  onClose,
  onRegenerate,
}: Props) => {
  const [pendingOriginIds, setPendingOriginIds] = useState<Set<string>>(
    new Set(),
  );
  const [pendingConnectionKeys, setPendingConnectionKeys] = useState<
    Set<string>
  >(new Set());
  const [addedConnectionKeys, setAddedConnectionKeys] = useState<Set<string>>(
    new Set(),
  );
  const [connectionMessage, setConnectionMessage] = useState("");

  const handleRegenerate = () => {
    setConnectionMessage("");
    onRegenerate();
  };

  const addConnections = async (
    origin: GraphMovie,
    recommendations: RecommendationGroup["recommendations"],
  ) => {
    const keys = recommendations.map(
      (recommendation) => `${origin.id}:${recommendation.id}`,
    );
    setConnectionMessage("");
    setPendingOriginIds((current) => new Set(current).add(origin.id));
    setPendingConnectionKeys((current) => {
      const next = new Set(current);
      keys.forEach((key) => next.add(key));
      return next;
    });

    try {
      const response = await fetch("/api/grafo/conexiones", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceId: origin.id,
          recommendations: recommendations.map((recommendation) => ({
            movieId: recommendation.id,
            title: recommendation.title,
            poster: recommendation.poster,
            genres: recommendation.genres,
            description: recommendation.description,
            reason: recommendation.reason,
          })),
        }),
      });
      const result: unknown = await response.json();

      if (!response.ok || !isRecord(result) || result.ok !== true) {
        const error =
          isRecord(result) && typeof result.error === "string"
            ? result.error
            : "No se pudieron agregar las conexiones al grafo.";
        throw new Error(error);
      }

      setAddedConnectionKeys((current) => {
        const next = new Set(current);
        keys.forEach((key) => next.add(key));
        return next;
      });
      setConnectionMessage(
        recommendations.length === 1
          ? `Conexión agregada desde "${origin.title}".`
          : `Se agregaron ${recommendations.length} conexiones desde "${origin.title}".`,
      );
    } catch (error) {
      console.error("Error agregando conexiones:", error);
      setConnectionMessage(
        error instanceof Error
          ? error.message
          : "Ocurrió un error al agregar las conexiones.",
      );
    } finally {
      setPendingOriginIds((current) => {
        const next = new Set(current);
        next.delete(origin.id);
        return next;
      });
      setPendingConnectionKeys((current) => {
        const next = new Set(current);
        keys.forEach((key) => next.delete(key));
        return next;
      });
    }
  };

  return (
    <section
      id="watchlist-recommendations"
      className="watchlist-recommendation-panel"
      aria-label="Sugeridos para ti"
    >
      <div className="watchlist-recommendation-header">
        <button
          type="button"
          className="watchlist-recommendation-back"
          aria-label="Cerrar sugerencias"
          onClick={onClose}
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
        <h3>Sugeridos para ti</h3>
        <button
          type="button"
          className="watchlist-regenerate-button"
          aria-label="Generar de nuevo"
          title="Generar de nuevo"
          disabled={watchedMovieCount === 0 || isGenerating}
          onClick={handleRegenerate}
        >
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            width="20"
            height="20"
            fill="none"
          >
            <path
              d="M20 7v5h-5M4 17v-5h5"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M5.5 9a7 7 0 0 1 11.6-2L20 9M4 15l2.9 2a7 7 0 0 0 11.6-2"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </div>

      {watchedMovieCount === 0 && (
        <p className="watchlist-suggestion-message">
          Marca una película como vista para generar sugerencias.
        </p>
      )}

      {isGenerating && (
        <p className="watchlist-suggestion-message" aria-live="polite">
          Preparando sugerencias...
        </p>
      )}

      {error && (
        <p className="watchlist-suggestion-message" role="alert">
          {error}
        </p>
      )}

      {suggestions.length > 0 && !isGenerating && (
        <div className="watchlist-recommendation-groups">
          {suggestions.map(({ origin, recommendations }) => (
            <section
              className="watchlist-recommendation-group"
              key={origin.id}
            >
              <article className="watchlist-graph-card watchlist-origin-card">
                <img src={origin.poster} alt="" />
                <div>
                  <h4>{origin.title}</h4>
                  {origin.genres && origin.genres.length > 0 && (
                    <small>{origin.genres.join(" · ")}</small>
                  )}
                </div>
                {recommendations.length > 0 && (
                  <button
                    type="button"
                    className="watchlist-add-connections-button"
                    disabled={
                      pendingOriginIds.has(origin.id) ||
                      recommendations.every((recommendation) =>
                        addedConnectionKeys.has(
                          `${origin.id}:${recommendation.id}`,
                        ),
                      )
                    }
                    onClick={() => void addConnections(origin, recommendations)}
                  >
                    {pendingOriginIds.has(origin.id)
                      ? "Agregando..."
                      : recommendations.every((recommendation) =>
                            addedConnectionKeys.has(
                              `${origin.id}:${recommendation.id}`,
                            ),
                          )
                        ? "Conexiones agregadas"
                        : "Agregar conexiones"}
                  </button>
                )}
              </article>
              {recommendations.length > 0 ? (
                <div className="watchlist-recommendation-branches">
                  {recommendations.map((recommendation) => (
                    <div
                      className="watchlist-recommendation-link"
                      key={`${origin.id}-${recommendation.id}`}
                    >
                      <span
                        className="watchlist-graph-connector"
                        aria-hidden="true"
                      />
                      <article className="watchlist-graph-card watchlist-recommendation-card">
                        <img src={recommendation.poster} alt="" />
                        <div>
                          <h4>{recommendation.title}</h4>
                          <p>
                            {recommendation.reason ||
                              `Relacionada con ${origin.title}.`}
                          </p>
                          {recommendation.genres &&
                            recommendation.genres.length > 0 && (
                              <small className="watchlist-recommendation-genres">
                                {recommendation.genres.join(" · ")}
                              </small>
                            )}
                        </div>
                        <button
                          type="button"
                          className="watchlist-add-connection-button"
                          aria-label={`Agregar conexión de ${recommendation.title} con ${origin.title}`}
                          disabled={
                            pendingOriginIds.has(origin.id) ||
                            pendingConnectionKeys.has(
                              `${origin.id}:${recommendation.id}`,
                            ) ||
                            addedConnectionKeys.has(
                              `${origin.id}:${recommendation.id}`,
                            )
                          }
                          onClick={() =>
                            void addConnections(origin, [recommendation])
                          }
                        >
                          {pendingConnectionKeys.has(
                            `${origin.id}:${recommendation.id}`,
                          ) ? (
                            "Agregando..."
                          ) : addedConnectionKeys.has(
                              `${origin.id}:${recommendation.id}`,
                            ) ? (
                            "Agregada"
                          ) : (
                            <>
                              <span>Agregar</span>
                              <span>conexión</span>
                            </>
                          )}
                        </button>
                      </article>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="watchlist-suggestion-message">
                  No hay relaciones locales para {origin.title}.
                </p>
              )}
            </section>
          ))}
        </div>
      )}

      {connectionMessage && (
        <p className="watchlist-action-message" aria-live="polite">
          {connectionMessage}
        </p>
      )}
    </section>
  );
};
