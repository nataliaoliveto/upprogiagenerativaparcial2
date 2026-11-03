import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";
import type {
  MovieBatchInput,
  WatchlistItem,
} from "./src/data/interfaces.js";

interface AddConnectionsRequest {
  sourceId: string;
  recommendations: Array<Omit<MovieBatchInput, "sourceId">>;
}

const isWatchlist = (value: unknown): value is WatchlistItem[] =>
  Array.isArray(value) &&
  value.every(
    (item) =>
      item !== null &&
      typeof item === "object" &&
      typeof item.id === "string" &&
      typeof item.title === "string" &&
      typeof item.poster === "string" &&
      (item.genres === undefined ||
        (Array.isArray(item.genres) &&
          item.genres.every((genre: unknown) => typeof genre === "string"))) &&
      (item.status === undefined ||
        item.status === "pending" ||
        item.status === "completed"),
  );

const isAddConnectionsRequest = (
  value: unknown,
): value is AddConnectionsRequest =>
  value !== null &&
  typeof value === "object" &&
  "sourceId" in value &&
  typeof value.sourceId === "string" &&
  value.sourceId.trim().length > 0 &&
  "recommendations" in value &&
  Array.isArray(value.recommendations) &&
  value.recommendations.length > 0 &&
  value.recommendations.length <= 3 &&
  value.recommendations.every(
    (recommendation: unknown) =>
      recommendation !== null &&
      typeof recommendation === "object" &&
      "movieId" in recommendation &&
      typeof recommendation.movieId === "string" &&
      recommendation.movieId.length > 0 &&
      "title" in recommendation &&
      typeof recommendation.title === "string" &&
      recommendation.title.trim().length > 0 &&
      "poster" in recommendation &&
      typeof recommendation.poster === "string" &&
      "reason" in recommendation &&
      typeof recommendation.reason === "string" &&
      recommendation.reason.trim().length > 0 &&
      (!("genres" in recommendation) ||
        recommendation.genres === undefined ||
        (Array.isArray(recommendation.genres) &&
          recommendation.genres.every(
            (genre: unknown) => typeof genre === "string",
          ))) &&
      (!("description" in recommendation) ||
        recommendation.description === undefined ||
        typeof recommendation.description === "string"),
  );

const watchlistApi = (): Plugin => ({
  name: "watchlist-json-api",
  configureServer(server) {
    const dataFile = path.resolve(
      server.config.root,
      "src",
      "data",
      "watchlist_data.json",
    );

    server.middlewares.use(async (request, response, next) => {
      const requestPath = new URL(request.url ?? "/", "http://localhost")
        .pathname;
      if (requestPath !== "/api/watchlist") {
        next();
        return;
      }

      const sendJson = (status: number, data: unknown) => {
        response.statusCode = status;
        response.setHeader("Content-Type", "application/json; charset=utf-8");
        response.end(JSON.stringify(data));
      };

      try {
        if (request.method === "GET") {
          let items: WatchlistItem[] = [];
          try {
            const content = await readFile(dataFile, "utf-8");
            if (content.trim()) {
              items = JSON.parse(content) as WatchlistItem[];
            }
          } catch (error) {
            if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
          }

          await mkdir(path.dirname(dataFile), { recursive: true });
          await writeFile(dataFile, `${JSON.stringify(items, null, 2)}\n`);
          sendJson(200, items);
          return;
        }

        if (request.method !== "PUT") {
          sendJson(405, { error: "Método no permitido." });
          return;
        }

        let body = "";
        for await (const chunk of request) {
          body += chunk.toString();
          if (body.length > 1_000_000) {
            sendJson(413, {
              error: "La watchlist excede el tamaño permitido.",
            });
            return;
          }
        }

        const parsed: unknown = JSON.parse(body);
        if (!isWatchlist(parsed)) {
          sendJson(400, { error: "El contenido de la watchlist es inválido." });
          return;
        }

        await mkdir(path.dirname(dataFile), { recursive: true });
        const temporaryFile = `${dataFile}.tmp`;
        await writeFile(temporaryFile, `${JSON.stringify(parsed, null, 2)}\n`);
        await rename(temporaryFile, dataFile);
        sendJson(200, parsed);
      } catch (error) {
        console.error("Error en la API local de watchlist:", error);
        sendJson(500, {
          error:
            error instanceof Error
              ? error.message
              : "Error inesperado al acceder a la watchlist.",
        });
      }
    });

    server.middlewares.use(
      "/api/grafo/conexiones",
      async (request, response, next) => {
        if (request.method !== "POST") {
          next();
          return;
        }

        const sendJson = (status: number, data: unknown) => {
          response.statusCode = status;
          response.setHeader(
            "Content-Type",
            "application/json; charset=utf-8",
          );
          response.end(JSON.stringify(data));
        };

        let body = "";
        try {
          for await (const chunk of request) {
            body += chunk.toString();
            if (body.length > 100_000) {
              sendJson(413, { error: "La solicitud excede el tamaño permitido." });
              return;
            }
          }

          let parsed: unknown;
          try {
            parsed = JSON.parse(body);
          } catch {
            sendJson(400, { error: "El cuerpo de la solicitud no es JSON válido." });
            return;
          }
          if (!isAddConnectionsRequest(parsed)) {
            sendJson(400, { error: "Los datos de las conexiones son inválidos." });
            return;
          }

          const { addRecommendationsToGraph } =
            await import("../backend/src/graph_tools.ts");
          const detail = await addRecommendationsToGraph(
            parsed.sourceId,
            parsed.recommendations,
          );
          sendJson(200, { ok: true, detail });
        } catch (error) {
          console.error("Error agregando conexiones al grafo:", error);
          sendJson(500, {
            ok: false,
            error:
              error instanceof Error
                ? error.message
                : "Error inesperado al agregar las conexiones.",
          });
        }
      },
    );

    // API para el agente curador de grafo
    server.middlewares.use("/api/agente", async (req, res, next) => {
      if (req.method !== "POST") return next();

      let body = "";
      req.on("data", (chunk) => {
        body += chunk.toString();
      });

      req.on("end", async () => {
        try {
          const { prompt, source } = JSON.parse(body);
          const requestSource =
            source === "watchlist_panel" ? "watchlist_panel" : "search_bar";
          // Importamos y ejecutamos el agente desde backend/src/agente_curador_nube.ts
          const { ejecutarCuradorGrafo } =
            await import("../backend/src/agente_curador_nube.ts");
          const resultado = await ejecutarCuradorGrafo(prompt, requestSource);

          res.setHeader("Content-Type", "application/json");
          res.statusCode = 200;
          res.end(JSON.stringify(resultado));
        } catch (error) {
          const message =
            error instanceof Error ? error.message : String(error);
          res.setHeader("Content-Type", "application/json");
          res.statusCode = 500;
          res.end(JSON.stringify({ ok: false, error: message }));
        }
      });
    });
  },
});

export default defineConfig({
  plugins: [react(), watchlistApi()],
});
