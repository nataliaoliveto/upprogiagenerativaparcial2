export interface GraphMovie {
  id: string;
  title: string;
  poster: string;
  description?: string;
  genres?: string[];
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
}

export interface GraphData {
  nodes: GraphMovie[];
  edges: GraphEdge[];
}

export interface WatchlistItem {
  id: string;
  title: string;
  poster: string;
  genres?: string[];
  status?: "pending" | "completed";
}

export interface TmdbMovieResult {
  id: string;
  title: string;
  overview: string;
  poster: string;
}

export interface MovieBatchInput {
  movieId: string;
  title: string;
  poster: string;
  sourceId?: string;
  reason?: string;
  genres?: string[];
  description?: string;
}
