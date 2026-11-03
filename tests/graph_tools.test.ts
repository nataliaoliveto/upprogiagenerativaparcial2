import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  addRecommendationsToGraph,
  addToGraph,
  clearRecommendations,
  readGraph,
  removeFromGraph,
  searchTmdb,
} from "../backend/src/graph_tools.js";
import { extraerJsonRobusto } from "../backend/src/agente_curador_nube.js";
import type { MovieBatchInput } from "../frontend/src/data/interfaces.js";
import {
  crearGrafoMockInicial,
  mockTmdbEmptyResponse,
  mockTmdbSearchResponse,
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

const isMissingFileError = (error: unknown): boolean =>
  error instanceof Error && "code" in error && error.code === "ENOENT";

describe("Pruebas unitarias", () => {
  describe("extraerJsonRobusto", () => {
    it("parsea JSON limpio", () => {
      // Arrange (Organizar)
      const texto = JSON.stringify({
        skill_invocada: "SKILL_1_CREACION",
        accion: "add_to_graph",
        mensaje_confirmacion: "Grafo creado con éxito.",
      });

      // Act (Actuar)
      const resultado = extraerJsonRobusto(texto);

      // Assert (Afirmar)
      expect(resultado).toEqual({
        skill_invocada: "SKILL_1_CREACION",
        accion: "add_to_graph",
        mensaje_confirmacion: "Grafo creado con éxito.",
      });
    });

    it("extrae JSON en Markdown cuando la respuesta contiene texto adicional", () => {
      // Arrange (Organizar)
      const texto = `Respuesta del agente:
\`\`\`json
{"skill_invocada":"SKILL_2_ELIMINACION","accion":"remove_from_graph","mensaje_confirmacion":"Película eliminada."}
\`\`\`
Fin de la respuesta.`;

      // Act (Actuar)
      const resultado = extraerJsonRobusto(texto);

      // Assert (Afirmar)
      expect(resultado).toEqual({
        skill_invocada: "SKILL_2_ELIMINACION",
        accion: "remove_from_graph",
        mensaje_confirmacion: "Película eliminada.",
      });
    });
  });

  describe("validaciones de graph_tools", () => {
    it.each(["", "   "])(
      "searchTmdb rechaza el título vacío %j con el error exacto",
      async (titulo) => {
        // Arrange (Organizar)
        const errorEsperado = new Error(
          "El título de la película no puede estar vacío.",
        );

        // Act (Actuar)
        const resultado = searchTmdb(titulo);

        // Assert (Afirmar)
        await expect(resultado).rejects.toThrow(errorEsperado);
      },
    );

    it("addToGraph rechaza un array vacío con el error exacto", async () => {
      // Arrange (Organizar)
      const peliculas: MovieBatchInput[] = [];
      const errorEsperado = new Error(
        "La lista de películas a agregar no puede estar vacía.",
      );

      // Act (Actuar)
      const resultado = addToGraph(peliculas);

      // Assert (Afirmar)
      await expect(resultado).rejects.toThrow(errorEsperado);
    });

    it("addRecommendationsToGraph rechaza un array vacío con el error exacto", async () => {
      // Arrange (Organizar)
      const recomendaciones: Array<Omit<MovieBatchInput, "sourceId">> = [];
      const errorEsperado = new Error(
        "Debes indicar al menos una conexión para agregar.",
      );

      // Act (Actuar)
      const resultado = addRecommendationsToGraph("603", recomendaciones);

      // Assert (Afirmar)
      await expect(resultado).rejects.toThrow(errorEsperado);
    });

    it.each(["", "   "])(
      "removeFromGraph rechaza el ID vacío %j con el error exacto",
      async (movieId) => {
        // Arrange (Organizar)
        const errorEsperado = new Error(
          "El ID de la película a eliminar es obligatorio.",
        );

        // Act (Actuar)
        const resultado = removeFromGraph(movieId);

        // Assert (Afirmar)
        await expect(resultado).rejects.toThrow(errorEsperado);
      },
    );

    it.each(["", "   "])(
      "clearRecommendations rechaza el ID vacío %j con el error exacto",
      async (movieId) => {
        // Arrange (Organizar)
        const errorEsperado = new Error(
          "El ID de la película original es obligatorio.",
        );

        // Act (Actuar)
        const resultado = clearRecommendations(movieId);

        // Assert (Afirmar)
        await expect(resultado).rejects.toThrow(errorEsperado);
      },
    );
  });
});

describe("Pruebas de integración", () => {
  let backupGrafoOriginal: string | null = null;

  beforeEach(async () => {
    try {
      backupGrafoOriginal = await fs.readFile(DATA_FILE_PATH, "utf-8");
    } catch (error) {
      if (!isMissingFileError(error)) {
        throw error;
      }
      backupGrafoOriginal = null;
    }

    await fs.writeFile(
      DATA_FILE_PATH,
      JSON.stringify(crearGrafoMockInicial(), null, 2),
      "utf-8",
    );
  });

  afterEach(async () => {
    try {
      await fs.readFile(DATA_FILE_PATH, "utf-8");
      if (backupGrafoOriginal === null) {
        await fs.unlink(DATA_FILE_PATH);
      } else {
        await fs.writeFile(DATA_FILE_PATH, backupGrafoOriginal, "utf-8");
      }
    } catch (error) {
      if (!isMissingFileError(error)) {
        throw error;
      }
      if (backupGrafoOriginal !== null) {
        await fs.writeFile(DATA_FILE_PATH, backupGrafoOriginal, "utf-8");
      }
    } finally {
      vi.restoreAllMocks();
    }
  });

  describe("searchTmdb con respuestas TMDB simuladas", () => {
    it("transforma una respuesta exitosa sin llamar a la red", async () => {
      // Arrange (Organizar)
      const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response(JSON.stringify(mockTmdbSearchResponse), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );

      // Act (Actuar)
      const pelicula = await searchTmdb("The Matrix");

      // Assert (Afirmar)
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(fetchMock.mock.calls[0][0]).toContain(
        "query=The%20Matrix&language=es-ES",
      );
      expect(pelicula).toEqual({
        id: "603",
        title: "The Matrix",
        overview:
          "A computer hacker learns about the true nature of reality.",
        poster:
          "https://image.tmdb.org/t/p/w500/f89U3ADr1oiB1s9GkdPOEpXUk5H.jpg",
      });
    });

    it("devuelve null cuando TMDB simulado no contiene resultados", async () => {
      // Arrange (Organizar)
      const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response(JSON.stringify(mockTmdbEmptyResponse), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );

      // Act (Actuar)
      const resultado = await searchTmdb("Película inexistente");

      // Assert (Afirmar)
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(resultado).toBeNull();
    });

    it("no filtra la URL ni la clave cuando fetch falla", async () => {
      // Arrange (Organizar)
      const fetchMock = vi
        .spyOn(globalThis, "fetch")
        .mockImplementation(async (input) => {
          throw new Error(String(input));
        });

      // Act (Actuar)
      const resultado = searchTmdb("The Matrix");

      // Assert (Afirmar)
      await expect(resultado).rejects.toThrow(
        "Error searching TMDB: Request failed.",
      );
      const requestedUrl = String(fetchMock.mock.calls[0][0]);
      await expect(resultado).rejects.not.toThrow(requestedUrl);
      expect(requestedUrl).toContain("api_key=");
    });

    it("no filtra la URL ni la clave cuando falla el parseo de la respuesta", async () => {
      // Arrange (Organizar)
      const respuesta = new Response(null, { status: 200 });
      const fetchMock = vi
        .spyOn(globalThis, "fetch")
        .mockResolvedValue(respuesta);
      vi.spyOn(respuesta, "json").mockRejectedValue(
        new Error("El parser recibió datos inválidos."),
      );

      // Act (Actuar)
      const resultado = searchTmdb("The Matrix");

      // Assert (Afirmar)
      await expect(resultado).rejects.toThrow(
        "Error searching TMDB: Invalid response.",
      );
      const requestedUrl = String(fetchMock.mock.calls[0][0]);
      await expect(resultado).rejects.not.toThrow(requestedUrl);
      expect(requestedUrl).toContain("api_key=");
    });
  });

  describe("operaciones encadenadas sobre el grafo", () => {
    it("agrega recomendaciones, limpia las ramas y elimina el nodo raíz", async () => {
      // Arrange (Organizar)
      const recomendaciones: Array<Omit<MovieBatchInput, "sourceId">> = [
        {
          movieId: "157336",
          title: "Interstellar",
          poster: "https://image.tmdb.org/t/p/w500/interstellar.jpg",
          reason: "Ciencia ficción y exploración espacial.",
          genres: ["Ciencia Ficción", "Drama"],
        },
        {
          movieId: "27205",
          title: "Inception",
          poster: "https://image.tmdb.org/t/p/w500/inception.jpg",
          reason: "Realidades construidas dentro de la mente.",
          genres: ["Ciencia Ficción", "Acción"],
        },
      ];

      // Act (Actuar)
      const detalleAdicion = await addRecommendationsToGraph(
        "603",
        recomendaciones,
      );
      const grafoConRecomendaciones = await readGraph();

      // Assert (Afirmar)
      expect(detalleAdicion).toBe("Success! 2 movies added to graph.");
      expect(grafoConRecomendaciones.nodes.map(({ id }) => id)).toEqual([
        "603",
        "157336",
        "27205",
      ]);
      expect(grafoConRecomendaciones.edges).toEqual([
        {
          id: "e-603-157336",
          source: "603",
          target: "157336",
          label: "Ciencia ficción y exploración espacial.",
        },
        {
          id: "e-603-27205",
          source: "603",
          target: "27205",
          label: "Realidades construidas dentro de la mente.",
        },
      ]);

      // Act (Actuar)
      const detalleLimpieza = await clearRecommendations("603");
      const grafoSinRecomendaciones = await readGraph();

      // Assert (Afirmar)
      expect(detalleLimpieza).toBe(
        "¡Éxito! Se eliminaron 2 recomendaciones, pero se conservó la película original.",
      );
      expect(grafoSinRecomendaciones.nodes.map(({ id }) => id)).toEqual([
        "603",
      ]);
      expect(grafoSinRecomendaciones.edges).toHaveLength(0);

      // Act (Actuar)
      const detalleEliminacion = await removeFromGraph("603");
      const grafoVacio = await readGraph();

      // Assert (Afirmar)
      expect(detalleEliminacion).toBe(
        "¡Éxito! Se eliminaron 1 películas del grafo (nodo principal y asociados).",
      );
      expect(grafoVacio).toEqual({ nodes: [], edges: [] });
    });
  });
});
