import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  readGraph,
  searchTmdb,
  addToGraph,
  addRecommendationsToGraph,
  clearRecommendations,
  removeFromGraph,
} from "../backend/src/graph_tools.js";
import { extraerJsonRobusto } from "../backend/src/agente_curador_nube.js";
import {
  mockTmdbSearchResponse,
  mockTmdbEmptyResponse,
  crearGrafoMockInicial,
} from "./mocks/tmdb.mock.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_FILE_PATH = path.resolve(
  __dirname,
  "..",
  "frontend",
  "src",
  "data",
  "graph_data.json",
);

describe("Suite de Pruebas - CuradorGrafo (Unitarias e Integración)", () => {
  let backupGrafoOriginal: string;

  beforeEach(async () => {
    // Guardamos copia intacta del grafo real antes de cada prueba
    try {
      backupGrafoOriginal = await fs.readFile(DATA_FILE_PATH, "utf-8");
    } catch {
      backupGrafoOriginal = JSON.stringify({ nodes: [], edges: [] }, null, 2);
    }
    await fs.writeFile(
      DATA_FILE_PATH,
      JSON.stringify(crearGrafoMockInicial(), null, 2),
      "utf-8",
    );
  });

  afterEach(async () => {
    // Restauramos el grafo real y limpiamos los mocks
    await fs.writeFile(DATA_FILE_PATH, backupGrafoOriginal, "utf-8");
    vi.restoreAllMocks();
  });

  // =========================================================================
  // 1. PRUEBAS UNITARIAS (Patrón AAA, Casos Típicos, Límites y Excepciones)
  // =========================================================================

  it("Unitaria (Caso Típico): extraerJsonRobusto limpia bloques markdown ```json y parsea la decisión", () => {
    // Arrange (Organizar)
    const respuestaCrudaLLM = `\`\`\`json
    {
      "skill_invocada": "SKILL_1_CREACION",
      "accion": "add_to_graph",
      "mensaje_confirmacion": "Grafo creado con éxito."
    }
    \`\`\``;

    // Act (Actuar)
    const resultado = extraerJsonRobusto(respuestaCrudaLLM);

    // Assert (Afirmar)
    expect(resultado.skill_invocada).toBe("SKILL_1_CREACION");
    expect(resultado.accion).toBe("add_to_graph");
    expect(resultado.mensaje_confirmacion).toBe("Grafo creado con éxito.");
  });

  it("Unitaria (Caso Límite / Excepción): searchTmdb lanza error si el título está vacío o tiene solo espacios", async () => {
    // Arrange (Organizar)
    const tituloInvalido = "   ";

    // Act & Assert (Actuar y Afirmar)
    await expect(searchTmdb(tituloInvalido)).rejects.toThrow(
      "El título de la película no puede estar vacío.",
    );
  });

  it("Unitaria (Caso Límite / Excepción): addToGraph rechaza un lote de películas vacío", async () => {
    // Arrange (Organizar)
    const loteVacio: any[] = [];

    // Act & Assert (Actuar y Afirmar)
    await expect(addToGraph(loteVacio)).rejects.toThrow(
      "La lista de películas a agregar no puede estar vacía.",
    );
  });

  it("Unitaria (Caso Límite / Excepción): removeFromGraph y clearRecommendations exigen un ID obligatorio", async () => {
    // Arrange (Organizar)
    const idVacio = "";

    // Act & Assert (Actuar y Afirmar)
    await expect(removeFromGraph(idVacio)).rejects.toThrow(
      "El ID de la película a eliminar es obligatorio.",
    );
    await expect(clearRecommendations(idVacio)).rejects.toThrow(
      "El ID de la película original es obligatorio.",
    );
  });

  // =========================================================================
  // 2. PRUEBAS DE INTEGRACIÓN CON MOCKS (TMDB API + Ciclo de Vida del Grafo)
  // =========================================================================

  it("Integración con Mock: searchTmdb formatea correctamente la respuesta de TMDB sin usar la red real", async () => {
    // Arrange (Organizar)
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockTmdbSearchResponse,
    } as Response);

    // Act (Actuar)
    const pelicula = await searchTmdb("The Matrix");

    // Assert (Afirmar)
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(pelicula).not.toBeNull();
    expect(pelicula?.id).toBe("603");
    expect(pelicula?.title).toBe("The Matrix");
    expect(pelicula?.poster).toBe(
      "https://image.tmdb.org/t/p/w500/f89U3ADr1oiB1s9GkdPOEpXUk5H.jpg",
    );
  });

  it("Integración con Mock (Caso Límite): searchTmdb devuelve null cuando TMDB no encuentra resultados", async () => {
    // Arrange (Organizar)
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockTmdbEmptyResponse,
    } as Response);

    // Act (Actuar)
    const resultado = await searchTmdb("PeliculaInexistenteXYZ123");

    // Assert (Afirmar)
    expect(resultado).toBeNull();
  });

  it("Integración Completa del Grafo: agregar recomendaciones -> limpiar ramas hijas -> eliminar nodo raíz en cascada", async () => {
    // Arrange (Organizar)
    const nuevasRecomendaciones = [
      {
        movieId: "157336",
        title: "Interstellar",
        poster: "https://image.tmdb.org/t/p/w500/interstellar.jpg",
        reason: "Explora dimensiones y ciencia ficción profunda.",
        genres: ["Ciencia Ficción", "Drama"],
      },
      {
        movieId: "27205",
        title: "Inception",
        poster: "https://image.tmdb.org/t/p/w500/inception.jpg",
        reason: "Mundos simulados dentro de la mente.",
        genres: ["Ciencia Ficción", "Acción"],
      },
    ];

    // Act 1 (Actuar): Agregar recomendaciones conectadas al nodo raíz "603" (The Matrix)
    await addRecommendationsToGraph("603", nuevasRecomendaciones);
    const grafoConHijos = await readGraph();

    // Assert 1 (Afirmar): Deben existir 3 nodos (1 padre + 2 hijos) y 2 aristas
    expect(grafoConHijos.nodes).toHaveLength(3);
    expect(grafoConHijos.edges).toHaveLength(2);

    // Act 2 (Actuar): Limpiar solo las recomendaciones de "603" conservando la película original
    await clearRecommendations("603");
    const grafoSinHijos = await readGraph();

    // Assert 2 (Afirmar): Solo queda el nodo padre "603" y 0 aristas
    expect(grafoSinHijos.nodes).toHaveLength(1);
    expect(grafoSinHijos.nodes[0].id).toBe("603");
    expect(grafoSinHijos.edges).toHaveLength(0);

    // Act 3 (Actuar): Eliminar el nodo raíz "603"
    await removeFromGraph("603");
    const grafoVacio = await readGraph();

    // Assert 3 (Afirmar): El grafo queda completamente vacío
    expect(grafoVacio.nodes).toHaveLength(0);
  });
});
