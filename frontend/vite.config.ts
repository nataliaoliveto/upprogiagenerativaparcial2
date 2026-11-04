import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import type { IncomingMessage, ServerResponse } from "node:http";
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

interface AgentRequest {
  prompt: string;
  source?: "search_bar" | "watchlist_panel";
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);

const hasOnlyKeys = (
  value: Record<string, unknown>,
  allowedKeys: readonly string[],
): boolean => Object.keys(value).every((key) => allowedKeys.includes(key));

const isBoundedString = (
  value: unknown,
  maxLength: number,
  allowEmpty = false,
): value is string =>
  typeof value === "string" &&
  value.length <= maxLength &&
  (allowEmpty || value.trim().length > 0);

const isStringArray = (
  value: unknown,
  maxItems: number,
  maxItemLength: number,
): value is string[] =>
  Array.isArray(value) &&
  value.length <= maxItems &&
  value.every((item: unknown) => isBoundedString(item, maxItemLength));

const isWatchlistItem = (value: unknown): value is WatchlistItem =>
  isRecord(value) &&
  hasOnlyKeys(value, ["id", "title", "poster", "genres", "status"]) &&
  isBoundedString(value.id, 128) &&
  isBoundedString(value.title, 200) &&
  isBoundedString(value.poster, 2_048, true) &&
  (value.genres === undefined || isStringArray(value.genres, 20, 80)) &&
  (value.status === undefined ||
    value.status === "pending" ||
    value.status === "completed");

const isWatchlist = (value: unknown): value is WatchlistItem[] =>
  Array.isArray(value) &&
  value.length <= 250 &&
  value.every((item: unknown) => isWatchlistItem(item));

const isRecommendation = (
  value: unknown,
): value is Omit<MovieBatchInput, "sourceId"> =>
  isRecord(value) &&
  hasOnlyKeys(value, [
    "movieId",
    "title",
    "poster",
    "reason",
    "genres",
    "description",
  ]) &&
  isBoundedString(value.movieId, 128) &&
  isBoundedString(value.title, 200) &&
  isBoundedString(value.poster, 2_048, true) &&
  isBoundedString(value.reason, 500) &&
  (value.genres === undefined || isStringArray(value.genres, 20, 80)) &&
  (value.description === undefined ||
    isBoundedString(value.description, 2_000, true));

const isAddConnectionsRequest = (
  value: unknown,
): value is AddConnectionsRequest =>
  isRecord(value) &&
  hasOnlyKeys(value, ["sourceId", "recommendations"]) &&
  isBoundedString(value.sourceId, 128) &&
  Array.isArray(value.recommendations) &&
  value.recommendations.length > 0 &&
  value.recommendations.length <= 3 &&
  value.recommendations.every((item: unknown) => isRecommendation(item));

const isAgentRequest = (value: unknown): value is AgentRequest =>
  isRecord(value) &&
  hasOnlyKeys(value, ["prompt", "source"]) &&
  isBoundedString(value.prompt, 4_000) &&
  (value.source === undefined ||
    value.source === "search_bar" ||
    value.source === "watchlist_panel");

const readRequestBody = async (
  request: IncomingMessage,
  maxBytes: number,
): Promise<string | null> => {
  const chunks: Buffer[] = [];
  let totalBytes = 0;
  let exceedsLimit = false;

  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    totalBytes += buffer.byteLength;
    if (totalBytes > maxBytes) {
      exceedsLimit = true;
      chunks.length = 0;
      continue;
    }
    if (!exceedsLimit) chunks.push(buffer);
  }

  return exceedsLimit ? null : Buffer.concat(chunks).toString("utf-8");
};

const hasJsonContentType = (request: IncomingMessage): boolean =>
  request.headers["content-type"]?.split(";")[0].trim().toLowerCase() ===
  "application/json";

const sendJson = (
  response: ServerResponse,
  status: number,
  data: unknown,
): void => {
  response.statusCode = status;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.end(JSON.stringify(data));
};

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

      try {
        if (request.method === "GET") {
          let items: WatchlistItem[] = [];
          try {
            const content = await readFile(dataFile, "utf-8");
            if (content.trim()) {
              const parsed: unknown = JSON.parse(content);
              if (!isWatchlist(parsed)) {
                sendJson(500, {
                  error: "No se pudo leer la watchlist almacenada.",
                });
                return;
              }
              items = parsed;
            }
          } catch (error) {
            if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
          }

          await mkdir(path.dirname(dataFile), { recursive: true });
          await writeFile(dataFile, `${JSON.stringify(items, null, 2)}\n`);
          sendJson(response, 200, items);
          return;
        }

        if (request.method !== "PUT") {
          sendJson(response, 405, { error: "Método no permitido." });
          return;
        }

        if (!hasJsonContentType(request)) {
          sendJson(response, 415, {
            error: "El tipo de contenido debe ser application/json.",
          });
          return;
        }

        const body = await readRequestBody(request, 512_000);
        if (body === null) {
          sendJson(response, 413, {
            error: "La watchlist excede el tamaño permitido.",
          });
          return;
        }

        let parsed: unknown;
        try {
          parsed = JSON.parse(body);
        } catch {
          sendJson(response, 400, {
            error: "El contenido de la watchlist no es JSON válido.",
          });
          return;
        }
        if (!isWatchlist(parsed)) {
          sendJson(response, 400, {
            error: "El contenido de la watchlist es inválido.",
          });
          return;
        }

        await mkdir(path.dirname(dataFile), { recursive: true });
        const temporaryFile = `${dataFile}.tmp`;
        await writeFile(temporaryFile, `${JSON.stringify(parsed, null, 2)}\n`);
        await rename(temporaryFile, dataFile);
        sendJson(response, 200, parsed);
      } catch {
        console.error("Error interno en la API local de watchlist.");
        sendJson(response, 500, {
          error: "Error interno al acceder a la watchlist.",
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

        try {
          if (!hasJsonContentType(request)) {
            sendJson(response, 415, {
              error: "El tipo de contenido debe ser application/json.",
            });
            return;
          }

          const body = await readRequestBody(request, 64_000);
          if (body === null) {
            sendJson(response, 413, {
              error: "La solicitud excede el tamaño permitido.",
            });
            return;
          }

          let parsed: unknown;
          try {
            parsed = JSON.parse(body);
          } catch {
            sendJson(response, 400, {
              error: "El cuerpo de la solicitud no es JSON válido.",
            });
            return;
          }
          if (!isAddConnectionsRequest(parsed)) {
            sendJson(response, 400, {
              error: "Los datos de las conexiones son inválidos.",
            });
            return;
          }

          const { addRecommendationsToGraph } =
            await import("../backend/src/graph_tools.ts");
          const detail = await addRecommendationsToGraph(
            parsed.sourceId,
            parsed.recommendations,
          );
          sendJson(response, 200, { ok: true, detail });
        } catch {
          console.error("Error interno agregando conexiones al grafo.");
          sendJson(response, 500, {
            ok: false,
            error: "Error interno al agregar las conexiones.",
          });
        }
      },
    );

    // API para el agente curador de grafo
    server.middlewares.use("/api/agente", async (req, res, next) => {
      if (req.method !== "POST") return next();

      try {
        if (!hasJsonContentType(req)) {
          sendJson(res, 415, {
            ok: false,
            error: "El tipo de contenido debe ser application/json.",
          });
          return;
        }

        const body = await readRequestBody(req, 32_768);
        if (body === null) {
          sendJson(res, 413, {
            ok: false,
            error: "La solicitud excede el tamaño permitido.",
          });
          return;
        }

        let parsed: unknown;
        try {
          parsed = JSON.parse(body);
        } catch {
          sendJson(res, 400, {
            ok: false,
            error: "El cuerpo de la solicitud no es JSON válido.",
          });
          return;
        }
        if (!isAgentRequest(parsed)) {
          sendJson(res, 400, {
            ok: false,
            error: "Los datos de la solicitud del agente son inválidos.",
          });
          return;
        }

        const requestSource = parsed.source ?? "search_bar";
        const { ejecutarCuradorGrafo } =
          await import("../backend/src/agente_curador_nube.ts");
        const resultado = await ejecutarCuradorGrafo(
          parsed.prompt,
          requestSource,
        );
        sendJson(res, 200, resultado);
      } catch {
        console.error("Error interno al ejecutar el agente.");
        sendJson(res, 500, {
          ok: false,
          error: "No se pudo procesar la solicitud del agente.",
        });
      }
    });
  },
});

export default defineConfig({
  plugins: [react(), watchlistApi()],
});
