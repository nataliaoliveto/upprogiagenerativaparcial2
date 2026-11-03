import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import type {
  GraphData,
  MovieBatchInput,
  TmdbMovieResult,
  WatchlistItem,
} from "../../frontend/src/data/interfaces.js";

// Obtenemos la ruta física de backend/src/ y subimos 2 niveles a la raíz del proyecto
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, "..", "..");

// A. Configuración de API Key (apunta siempre a backend/.env sin importar desde dónde se ejecute)
dotenv.config({ path: path.join(PROJECT_ROOT, "backend", ".env") });
const TMDB_API_KEY = process.env.TMDB_API_KEY;

if (!TMDB_API_KEY) {
  throw new Error(
    "FATAL ERROR: No se encontró la variable de entorno TMDB_API_KEY en backend/.env",
  );
}

// Apunta siempre a frontend/src/data/graph_data.json
const DATA_FILE_PATH = path.join(
  PROJECT_ROOT,
  "frontend",
  "src",
  "data",
  "graph_data.json",
);
const WATCHLIST_FILE_PATH = path.join(
  PROJECT_ROOT,
  "frontend",
  "src",
  "data",
  "watchlist_data.json",
);

// Herramienta 1: Leer el grafo
export async function readGraph(): Promise<GraphData> {
  try {
    const fileContent = await fs.readFile(DATA_FILE_PATH, "utf-8");
    const parsed = JSON.parse(fileContent);

    // Validación de estructura (Pruebas Unitarias)
    if (
      !parsed ||
      !Array.isArray(parsed.nodes) ||
      !Array.isArray(parsed.edges)
    ) {
      throw new Error(
        "El archivo graph_data.json no tiene una estructura de grafo válida (nodes/edges).",
      );
    }

    return parsed as GraphData;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Error al leer el grafo: ${message}`);
  }
}

// Herramienta 2: Consultar TMDB
export async function searchTmdb(
  title: string,
): Promise<TmdbMovieResult | null> {
  if (!title || title.trim() === "") {
    throw new Error("El título de la película no puede estar vacío.");
  }

  const url = `https://api.themoviedb.org/3/search/movie?query=${encodeURIComponent(title.trim())}&language=es-ES&api_key=${TMDB_API_KEY}`;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP Error: ${response.status}`);
    }

    const data = (await response.json()) as { results?: Array<any> };
    if (!data.results || data.results.length === 0) {
      return null;
    }

    const movie = data.results[0];
    return {
      id: movie.id.toString(),
      title: movie.title,
      overview: movie.overview ?? "",
      poster: movie.poster_path
        ? `https://image.tmdb.org/t/p/w500${movie.poster_path}`
        : "",
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Error searching TMDB: ${message}`);
  }
}

// Herramienta 3: Agregar al Grafo (Versión Batching)
export async function addToGraph(movies: MovieBatchInput[]): Promise<string> {
  if (!Array.isArray(movies) || movies.length === 0) {
    throw new Error("La lista de películas a agregar no puede estar vacía.");
  }

  try {
    const graph = await readGraph();

    for (const movie of movies) {
      if (!graph.nodes.find((n: any) => n.id === movie.movieId)) {
        graph.nodes.push({
          id: movie.movieId,
          title: movie.title,
          poster: movie.poster,
          genres: movie.genres,
          description: movie.description,
        });
      }

      if (movie.sourceId && movie.reason) {
        const edgeId = `e-${movie.sourceId}-${movie.movieId}`;
        if (!graph.edges.find((e: any) => e.id === edgeId)) {
          graph.edges.push({
            id: edgeId,
            source: movie.sourceId,
            target: movie.movieId,
            label: movie.reason,
          });
        }
      }
    }

    await fs.writeFile(DATA_FILE_PATH, JSON.stringify(graph, null, 2), "utf-8");
    return `Success! ${movies.length} movies added to graph.`;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Error modifying graph data: ${message}`);
  }
}

export async function addRecommendationsToGraph(
  sourceId: string,
  recommendations: Array<Omit<MovieBatchInput, "sourceId">>,
): Promise<string> {
  if (!sourceId.trim()) {
    throw new Error("El ID de la película de origen es obligatorio.");
  }
  if (recommendations.length === 0) {
    throw new Error("Debes indicar al menos una conexión para agregar.");
  }

  const graph = await readGraph();
  if (!graph.nodes.some((movie) => movie.id === sourceId)) {
    throw new Error(`No se encontró la película de origen ${sourceId} en el grafo.`);
  }

  return addToGraph(
    recommendations.map((recommendation) => ({
      ...recommendation,
      sourceId,
    })),
  );
}

// Herramienta 4: Eliminar del Grafo (Con Borrado en Cascada)
export async function removeFromGraph(movieId: string): Promise<string> {
  if (!movieId || movieId.trim() === "") {
    throw new Error("El ID de la película a eliminar es obligatorio.");
  }

  try {
    const graph = await readGraph();

    // 1. Identificar si este nodo tiene "hijos" (recomendaciones que nacen de él)
    const edgesFromNode = graph.edges.filter((e: any) => e.source === movieId);
    const childNodeIds = edgesFromNode.map((e: any) => e.target);

    // 2. Agrupar todos los nodos a eliminar (El principal + sus hijos)
    const nodesToDelete = new Set([movieId, ...childNodeIds]);

    // 3. Filtrar los nodos para quitar los eliminados
    const initialNodeCount = graph.nodes.length;
    graph.nodes = graph.nodes.filter((n: any) => !nodesToDelete.has(n.id));

    if (graph.nodes.length === initialNodeCount) {
      return `No se encontró la película con ID ${movieId} en el grafo.`;
    }

    // 4. Filtrar las aristas (quitar flechas relacionadas a cualquiera de los nodos borrados)
    graph.edges = graph.edges.filter(
      (e: any) => !nodesToDelete.has(e.source) && !nodesToDelete.has(e.target),
    );

    // 5. Guardar los cambios
    await fs.writeFile(DATA_FILE_PATH, JSON.stringify(graph, null, 2), "utf-8");

    return `¡Éxito! Se eliminaron ${nodesToDelete.size} películas del grafo (nodo principal y asociados).`;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Error al eliminar datos del grafo: ${message}`);
  }
}

// Herramienta 5: Limpiar Recomendaciones (Deja el padre, borra los hijos)
export async function clearRecommendations(movieId: string): Promise<string> {
  if (!movieId || movieId.trim() === "") {
    throw new Error("El ID de la película original es obligatorio.");
  }

  try {
    const graph = await readGraph();

    // 1. Identificar solo a los "hijos" (nodos destino de las flechas que salen del movieId)
    const edgesFromNode = graph.edges.filter((e: any) => e.source === movieId);
    const childNodeIds = new Set(edgesFromNode.map((e: any) => e.target));

    if (childNodeIds.size === 0) {
      return `La película con ID ${movieId} no tiene recomendaciones generadas para borrar.`;
    }

    // 2. Filtrar los nodos: mantenemos todos MENOS los hijos
    graph.nodes = graph.nodes.filter((n: any) => !childNodeIds.has(n.id));

    // 3. Filtrar las aristas: quitamos cualquier flecha conectada a los hijos borrados
    graph.edges = graph.edges.filter(
      (e: any) => !childNodeIds.has(e.source) && !childNodeIds.has(e.target),
    );

    // 4. Guardar los cambios
    await fs.writeFile(DATA_FILE_PATH, JSON.stringify(graph, null, 2), "utf-8");

    return `¡Éxito! Se eliminaron ${childNodeIds.size} recomendaciones, pero se conservó la película original.`;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Error al limpiar las recomendaciones: ${message}`);
  }
}

// Herramienta 6: Leer las favoritas para contextualizar sugerencias
export async function readWatchlist(): Promise<WatchlistItem[]> {
  try {
    const content = await fs.readFile(WATCHLIST_FILE_PATH, "utf-8");
    if (!content.trim()) return [];

    return JSON.parse(content) as WatchlistItem[];
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Error al leer la watchlist: ${message}`);
  }
}
