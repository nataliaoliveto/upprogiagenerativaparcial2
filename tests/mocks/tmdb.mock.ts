import type { GraphData } from "../../frontend/src/data/interfaces.js";

export const mockTmdbSearchResponse = {
  results: [
    {
      id: 603,
      title: "The Matrix",
      overview: "A computer hacker learns about the true nature of reality.",
      poster_path: "/f89U3ADr1oiB1s9GkdPOEpXUk5H.jpg",
    },
  ],
};

export const mockTmdbEmptyResponse = {
  results: [],
};

export const crearGrafoMockInicial = (): GraphData => ({
  nodes: [{ id: "603", title: "The Matrix", poster: "" }],
  edges: [],
});
