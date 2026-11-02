import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";

interface WatchlistItem {
  id: string;
  title: string;
  poster: string;
  genres?: string[];
  status?: "pending" | "completed";
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
      const requestPath = new URL(
        request.url ?? "/",
        "http://localhost",
      ).pathname;
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
              const parsed: unknown = JSON.parse(content);
              if (!isWatchlist(parsed)) {
                throw new Error("El archivo de watchlist tiene un formato inválido.");
              }
              items = parsed;
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
            sendJson(413, { error: "La watchlist excede el tamaño permitido." });
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
  },
});

export default defineConfig({
  plugins: [react(), watchlistApi()],
});
