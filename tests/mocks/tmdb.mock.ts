import type { GraphData } from "../../frontend/src/data/interfaces.js";

/**
 * Mock de respuesta de la API de TMDB para aislar pruebas sin usar internet real.
 */
export const mockTmdbSearchResponse = {
  results: [
    {
      id: 603,
      title: "The Matrix",
      overview: "Un programador descubre que la realidad es una simulación.",
      poster_path: "/f89U3ADr1oiB1s9GkdPOEpXUk5H.jpg",
    },
  ],
};

export const mockTmdbEmptyResponse = {
  results: [],
};

/**
 * Estado inicial simulado del grafo para pruebas de integración aisladas.
 */
export const crearGrafoMockInicial = (): GraphData => ({
  nodes: [
    {
      id: "603",
      title: "The Matrix",
      poster:
        "[https://image.tmdb.org/t/p/w500/f89U3ADr1oiB1s9GkdPOEpXUk5H.jpg](https://image.tmdb.org/t/p/w500/f89U3ADr1oiB1s9GkdPOEpXUk5H.jpg)",
      genres: ["Ciencia Ficción", "Acción"],
      description: "Un programador descubre que la realidad es una simulación.",
    },
  ],
  edges: [],
});
