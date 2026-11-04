import type { GraphData } from "../../frontend/src/data/interfaces.js";

export interface TmdbMockMovie {
  id: number;
  title: string;
  overview: string;
  poster_path: string | null;
}

export interface TmdbMockResponse {
  results: TmdbMockMovie[];
}

export const tmdbSearchSuccessResponse: TmdbMockResponse = {
  results: [
    {
      id: 603,
      title: "The Matrix",
      overview: "A computer hacker learns about the true nature of reality.",
      poster_path: "/f89U3ADr1oiB1s9GkdPOEpXUk5H.jpg",
    },
  ],
};

export const tmdbSearchEmptyResponse: TmdbMockResponse = {
  results: [],
};

export const initialGraphMock: GraphData = {
  nodes: [
    {
      id: "source-movie",
      title: "Película de origen",
      poster: "/source.jpg",
    },
    {
      id: "unrelated-movie",
      title: "Película independiente",
      poster: "/unrelated.jpg",
    },
  ],
  edges: [],
};
