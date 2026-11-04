import { readFile, unlink, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type {
  GraphData,
  MovieBatchInput,
  TmdbMovieResult,
} from "../frontend/src/data/interfaces.js";
import type { RespuestaAgenteJSON } from "../backend/src/agente_curador_nube.js";
import {
  initialGraphMock,
  tmdbSearchEmptyResponse,
  tmdbSearchSuccessResponse,
} from "./mocks/tmdb.mock.js";

process.env.TMDB_API_KEY = "vitest-test-api-key";

const graphFilePath = fileURLToPath(
  new URL("../frontend/src/data/graph_data.json", import.meta.url),
);
const { searchTmdb, addToGraph, addRecommendationsToGraph, removeFromGraph, clearRecommendations } =
  await import("../backend/src/graph_tools.js");
const { readGraph } = await import("../backend/src/graph_tools.js");
const { extraerJsonRobusto, ejecutarCuradorGrafo } = await import(
  "../backend/src/agente_curador_nube.js"
);

let graphBackup: string | null = null;

function isFileNotFound(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "ENOENT"
  );
}

describe("pruebas unitarias", () => {
  beforeEach(async () => {
    try {
      graphBackup = await readFile(graphFilePath, "utf-8");
    } catch (error) {
      if (!isFileNotFound(error)) {
        throw error;
      }
      graphBackup = null;
    }
  });

  afterEach(async () => {
    vi.restoreAllMocks();

    try {
      await readFile(graphFilePath, "utf-8");
    } catch (error) {
      if (!isFileNotFound(error)) {
        throw error;
      }
    }

    if (graphBackup === null) {
      try {
        await unlink(graphFilePath);
      } catch (error) {
        if (!isFileNotFound(error)) {
          throw error;
        }
      }
      return;
    }

    await writeFile(graphFilePath, graphBackup, "utf-8");
  });

  describe("extraerJsonRobusto", () => {
    it("parsea JSON limpio", () => {
      // Arrange (Organizar)
      const entrada: RespuestaAgenteJSON = {
        skill_invocada: "SKILL_1_CREACION",
        accion: "add_to_graph",
        mensaje_confirmacion: "Película agregada.",
      };
      const texto = JSON.stringify(entrada);

      // Act (Actuar)
      const resultado = extraerJsonRobusto(texto);

      // Assert (Afirmar)
      expect(resultado).toEqual(entrada);
    });

    it("extrae JSON envuelto en un bloque Markdown json", () => {
      // Arrange (Organizar)
      const entrada: RespuestaAgenteJSON = {
        skill_invocada: "SKILL_3_SUGERENCIAS",
        accion: "get_watchlist_recommendations",
        mensaje_confirmacion: "Aquí tienes sugerencias.",
      };
      const texto = `\`\`\`json\n${JSON.stringify(entrada)}\n\`\`\``;

      // Act (Actuar)
      const resultado = extraerJsonRobusto(texto);

      // Assert (Afirmar)
      expect(resultado).toEqual(entrada);
    });

    it("extrae JSON entre texto adicional", () => {
      // Arrange (Organizar)
      const entrada: RespuestaAgenteJSON = {
        skill_invocada: "SKILL_2_ELIMINACION",
        accion: "remove_from_graph",
        mensaje_confirmacion: "Película eliminada.",
      };
      const texto = `Resultado del agente:\n${JSON.stringify(entrada)}\nFin de la respuesta.`;

      // Act (Actuar)
      const resultado = extraerJsonRobusto(texto);

      // Assert (Afirmar)
      expect(resultado).toEqual(entrada);
    });
  });

  describe("validaciones de graph_tools", () => {
    it.each(["", "   "])(
      "rechaza pedidos vacíos del agente %j antes de acceder a dependencias",
      async (pedido) => {
        // Arrange (Organizar)
        const errorEsperado = "El pedido del usuario es obligatorio.";

        // Act (Actuar)
        const promesa = ejecutarCuradorGrafo(pedido);

        // Assert (Afirmar)
        await expect(promesa).rejects.toThrow(errorEsperado);
      },
    );

    it("rechaza pedidos del agente que superan el límite", async () => {
      // Arrange (Organizar)
      const pedido = "a".repeat(4_001);
      const errorEsperado =
        "El pedido del usuario excede el límite permitido.";

      // Act (Actuar)
      const promesa = ejecutarCuradorGrafo(pedido);

      // Assert (Afirmar)
      await expect(promesa).rejects.toThrow(errorEsperado);
    });

    it("rechaza títulos de TMDB por encima del límite", async () => {
      // Arrange (Organizar)
      const titulo = "a".repeat(201);
      const errorEsperado =
        "El título de la película excede el límite permitido.";
      const fetchMock = vi.spyOn(globalThis, "fetch");

      // Act (Actuar)
      const promesa = searchTmdb(titulo);

      // Assert (Afirmar)
      await expect(promesa).rejects.toThrow(errorEsperado);
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it.each(["", "   "])(
      "rechaza searchTmdb con el título vacío %j",
      async (titulo) => {
        // Arrange (Organizar)
        const errorEsperado = new Error(
          "El título de la película no puede estar vacío.",
        );

        // Act (Actuar)
        const promesa = searchTmdb(titulo);

        // Assert (Afirmar)
        await expect(promesa).rejects.toThrowError(errorEsperado);
      },
    );

    it("rechaza addToGraph con una lista vacía", async () => {
      // Arrange (Organizar)
      const peliculas: MovieBatchInput[] = [];
      const errorEsperado = new Error(
        "La lista de películas a agregar no puede estar vacía.",
      );

      // Act (Actuar)
      const promesa = addToGraph(peliculas);

      // Assert (Afirmar)
      await expect(promesa).rejects.toThrowError(errorEsperado);
    });

    it("rechaza addRecommendationsToGraph con una lista vacía", async () => {
      // Arrange (Organizar)
      const recomendaciones: Array<Omit<MovieBatchInput, "sourceId">> = [];
      const errorEsperado = new Error(
        "Debes indicar al menos una conexión para agregar.",
      );

      // Act (Actuar)
      const promesa = addRecommendationsToGraph("pelicula-origen", recomendaciones);

      // Assert (Afirmar)
      await expect(promesa).rejects.toThrowError(errorEsperado);
    });

    it.each(["", "   "])(
      "rechaza removeFromGraph con el ID vacío %j",
      async (movieId) => {
        // Arrange (Organizar)
        const errorEsperado = new Error(
          "El ID de la película a eliminar es obligatorio.",
        );

        // Act (Actuar)
        const promesa = removeFromGraph(movieId);

        // Assert (Afirmar)
        await expect(promesa).rejects.toThrowError(errorEsperado);
      },
    );

    it.each(["", "   "])(
      "rechaza clearRecommendations con el ID vacío %j",
      async (movieId) => {
        // Arrange (Organizar)
        const errorEsperado = new Error(
          "El ID de la película original es obligatorio.",
        );

        // Act (Actuar)
        const promesa = clearRecommendations(movieId);

        // Assert (Afirmar)
        await expect(promesa).rejects.toThrowError(errorEsperado);
      },
    );
  });
});

describe("pruebas de integración", () => {
  beforeEach(async () => {
    try {
      graphBackup = await readFile(graphFilePath, "utf-8");
    } catch (error) {
      if (!isFileNotFound(error)) {
        throw error;
      }
      graphBackup = null;
    }
  });

  afterEach(async () => {
    vi.restoreAllMocks();

    try {
      await readFile(graphFilePath, "utf-8");
    } catch (error) {
      if (!isFileNotFound(error)) {
        throw error;
      }
    }

    if (graphBackup === null) {
      try {
        await unlink(graphFilePath);
      } catch (error) {
        if (!isFileNotFound(error)) {
          throw error;
        }
      }
      return;
    }

    await writeFile(graphFilePath, graphBackup, "utf-8");
  });

  describe("searchTmdb con fetch simulado", () => {
    it("transforma un resultado exitoso de TMDB", async () => {
      // Arrange (Organizar)
      const fetchMock = vi
        .spyOn(globalThis, "fetch")
        .mockResolvedValue(
          new Response(JSON.stringify(tmdbSearchSuccessResponse), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }),
        );
      const titulo = "The Matrix";
      const resultadoEsperado: TmdbMovieResult = {
        id: "603",
        title: "The Matrix",
        overview:
          "A computer hacker learns about the true nature of reality.",
        poster: "https://image.tmdb.org/t/p/w500/f89U3ADr1oiB1s9GkdPOEpXUk5H.jpg",
      };

      // Act (Actuar)
      const resultado = await searchTmdb(titulo);

      // Assert (Afirmar)
      expect(resultado).toEqual(resultadoEsperado);
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining("query=The%20Matrix"),
        expect.objectContaining({ signal: expect.any(AbortSignal) }),
      );
    });

    it("devuelve null si TMDB responde con results vacío", async () => {
      // Arrange (Organizar)
      const fetchMock = vi
        .spyOn(globalThis, "fetch")
        .mockResolvedValue(
          new Response(JSON.stringify(tmdbSearchEmptyResponse), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }),
        );

      // Act (Actuar)
      const resultado = await searchTmdb("Película inexistente");

      // Assert (Afirmar)
      expect(resultado).toBeNull();
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining("query=Pel%C3%ADcula%20inexistente"),
        expect.objectContaining({ signal: expect.any(AbortSignal) }),
      );
    });

    it("no expone detalles de red ni la clave API en los errores", async () => {
      // Arrange (Organizar)
      vi.spyOn(globalThis, "fetch").mockRejectedValue(
        new Error(
          "fetch failed: https://api.themoviedb.org/3/search/movie?api_key=secret-value",
        ),
      );

      // Act (Actuar)
      const promesa = searchTmdb("Película");

      // Assert (Afirmar)
      await expect(promesa).rejects.toMatchObject({
        message: "Error al consultar TMDB. Intenta de nuevo.",
      });
    });
  });

  describe("ciclo integrado del grafo", () => {
    it("agrega, lee, limpia y elimina nodos preservando los datos ajenos", async () => {
      // Arrange (Organizar)
      const grafoInicial: GraphData = structuredClone(initialGraphMock);
      const recomendacion: Omit<MovieBatchInput, "sourceId"> = {
        movieId: "recommendation-movie",
        title: "Película recomendada",
        poster: "/recommendation.jpg",
        reason: "Comparte género con la película de origen.",
      };
      await writeFile(graphFilePath, JSON.stringify(grafoInicial, null, 2), "utf-8");

      // Act (Actuar)
      const resultadoAgregar = await addRecommendationsToGraph(
        "source-movie",
        [recomendacion],
      );
      const grafoConRecomendacion = await readGraph();
      const resultadoLimpiar = await clearRecommendations("source-movie");
      const grafoLimpio = await readGraph();
      await addRecommendationsToGraph("source-movie", [recomendacion]);
      const resultadoEliminar = await removeFromGraph("source-movie");
      const grafoFinal = await readGraph();

      // Assert (Afirmar)
      expect(resultadoAgregar).toBe("Success! 1 movies added to graph.");
      expect(grafoConRecomendacion.nodes.map((node) => node.id)).toEqual([
        "source-movie",
        "unrelated-movie",
        "recommendation-movie",
      ]);
      expect(grafoConRecomendacion.edges).toEqual([
        {
          id: "e-source-movie-recommendation-movie",
          source: "source-movie",
          target: "recommendation-movie",
          label: "Comparte género con la película de origen.",
        },
      ]);
      expect(resultadoLimpiar).toContain(
        "Se eliminaron 1 recomendaciones",
      );
      expect(grafoLimpio.nodes.map((node) => node.id)).toEqual([
        "source-movie",
        "unrelated-movie",
      ]);
      expect(grafoLimpio.edges).toEqual([]);
      expect(resultadoEliminar).toContain("Se eliminaron 2 películas");
      expect(grafoFinal.nodes.map((node) => node.id)).toEqual([
        "unrelated-movie",
      ]);
      expect(grafoFinal.edges).toEqual([]);
    });
  });
});
