import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import {
  readGraph,
  searchTmdb,
  addToGraph,
  removeFromGraph,
  clearRecommendations,
} from "./graph_tools.js";
import type { MovieBatchInput } from "../../frontend/src/data/interfaces.js";

// Calculamos la raíz del proyecto desde backend/src/
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, "..", "..");

// 1. Cargar variables de entorno desde backend/.env
dotenv.config({ path: path.join(PROJECT_ROOT, "backend", ".env") });

// Ruta exacta a .github/agents/curador_grafo.agent.md en la raíz del proyecto
const AGENT_MD_PATH = path.join(
  PROJECT_ROOT,
  ".github",
  "agents",
  "curador_grafo.agent.md",
);

// Lista de pools independientes de Gemini (del más potente al más liviano/rápido)
// Usa los nombres reales de los modelos de Gemini
//const MODELOS_GEMINI_POOL = ["gemini-flash-latest"];
//, "gemini-3.8-flash"
const MODELOS_GEMINI_POOL = ["gemini-3.5-flash-lite"];

// Interfaces de la respuesta JSON que devuelve el Agente según el .agent.md
export interface RecomendacionIA {
  title: string;
  genres: string[];
  reason: string;
}

export interface RespuestaAgenteJSON {
  skill_invocada: "SKILL_1_CREACION" | "SKILL_2_ELIMINACION";
  accion: "add_to_graph" | "remove_from_graph" | "clear_recommendations";
  pelicula_origen?: {
    title: string;
    genres: string[];
    description: string;
  };
  recomendaciones?: RecomendacionIA[];
  target_movie_id?: string;
  mensaje_confirmacion: string;
}

/**
 * Equivalente a cargar_prompt_agente() de agentes_simulacion.py:
 * Lee el archivo .agent.md y elimina la cabecera YAML (entre --- y ---).
 */
export async function cargarPromptAgente(): Promise<string> {
  try {
    let content = await fs.readFile(AGENT_MD_PATH, "utf-8");
    if (content.startsWith("---")) {
      const parts = content.split("---");
      if (parts.length >= 3) {
        content = parts.slice(2).join("---");
      }
    }
    return content.trim();
  } catch (error) {
    console.error("[Error leyendo curador_grafo.agent.md]:", error);
    throw new Error("No se pudo cargar el archivo declarativo del agente.");
  }
}

/**
 * Equivalente a extraer_json_robusto() de agentes_simulacion.py:
 * Limpia bloques markdown ```json y extrae el objeto JSON válido.
 */
export function extraerJsonRobusto(texto: string): RespuestaAgenteJSON {
  let textoLimpio = texto
    .replace(/```(?:json)?\s*/g, "")
    .replace(/```\s*$/g, "")
    .trim();
  const match = textoLimpio.match(/\{[\s\S]*\}/);
  if (match) {
    textoLimpio = match[0];
  }
  return JSON.parse(textoLimpio) as RespuestaAgenteJSON;
}

/**
 * Equivalente a llamar_ollama() + analizador_nube.py:
 * Envía el System Prompt (.agent.md) y el pedido del usuario a Gemini API
 * configurando temperatura, topP, maxOutputTokens y midiendo telemetría.
 */

export async function llamarGeminiNube(
  promptSistema: string,
  promptUsuario: string,
): Promise<{ decision: RespuestaAgenteJSON; telemetria: any }> {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("Falta configurar GEMINI_API_KEY en el servidor.");
  }

  let ultimoErrorStatus = 0;

  // Recorremos los pools de modelos: si uno da 503 por demanda, salta de inmediato al siguiente modelo real
  for (const modeloActual of MODELOS_GEMINI_POOL) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${modeloActual}:generateContent`;
    const inicio = Date.now();

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey,
        },
        body: JSON.stringify({
          system_instruction: {
            parts: [{ text: promptSistema }],
          },
          contents: [
            {
              role: "user",
              parts: [{ text: promptUsuario }],
            },
          ],
          generationConfig: {
            temperature: 0.1,
            topP: 0.8,
            maxOutputTokens: 1024,
            responseMimeType: "application/json",
          },
        }),
      });

      if (response.ok) {
        const data = (await response.json()) as any;
        const tiempoTotalSegundos = ((Date.now() - inicio) / 1000).toFixed(2);

        const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}";
        const decision = extraerJsonRobusto(rawText);

        const usage = data.usageMetadata ?? {};
        const telemetria = {
          modelo: modeloActual,
          tiempo_segundos: Number(tiempoTotalSegundos),
          tokens_entrada: usage.promptTokenCount ?? 0,
          tokens_salida: usage.candidatesTokenCount ?? 0,
          total_tokens: usage.totalTokenCount ?? 0,
        };

        console.log("\n===================================");
        console.log(`TELEMETRÍA DE AGENTE EN NUBE (${modeloActual})`);
        console.log("===================================");
        console.log(
          `Tiempo total (red + inferencia): ${telemetria.tiempo_segundos} s`,
        );
        console.log(
          `Tokens de entrada (Prompt):      ${telemetria.tokens_entrada}`,
        );
        console.log(
          `Tokens de salida (Respuesta):    ${telemetria.tokens_salida}`,
        );
        console.log(
          `Total tokens consumidos:         ${telemetria.total_tokens}`,
        );
        console.log("===================================\n");

        return { decision, telemetria };
      }

      ultimoErrorStatus = response.status;
      console.warn(
        `[Pool Saturado] El modelo ${modeloActual} devolvió HTTP ${response.status}. Saltando al siguiente modelo de Gemini...`,
      );
    } catch {
      console.warn(
        `[Error de Red] Falló la conexión con ${modeloActual}. Probando siguiente modelo...`,
      );
    }
  }

  throw new Error(
    `Todos los modelos de Gemini están temporalmente saturados (Último estado: HTTP ${ultimoErrorStatus}). Intenta de nuevo en unos segundos.`,
  );
}

/**
 * FUNCIÓN PRINCIPAL QUE DISPARA EL FRONTEND:
 * Recibe el texto del <input>, consulta al Agente Gemini y ejecuta las tools del grafo.
 */
export async function ejecutarCuradorGrafo(pedidoUsuario: string) {
  // 1. Leer el estado actual del grafo (Tool 1: readGraph)
  const grafoActual = await readGraph();

  // 2. Cargar las reglas y Skills desde .github/agents/curador_grafo.agent.md
  const promptSistema = await cargarPromptAgente();

  // 3. Armar el contexto de entrada para el usuario
  const promptUsuario = `Estado actual del grafo (JSON):
${JSON.stringify(grafoActual, null, 2)}

Pedido del usuario: "${pedidoUsuario}"`;

  // 4. Consultar a Gemini en la nube
  const { decision, telemetria } = await llamarGeminiNube(
    promptSistema,
    promptUsuario,
  );

  // 5. Ejecutar la Skill correspondiente usando las herramientas de graph_tools.ts
  let resultadoOperacion = "";

  if (decision.accion === "add_to_graph" && decision.pelicula_origen) {
    const lotePeliculas: MovieBatchInput[] = [];

    // Verificar si la película origen ya existe en el grafo o hay que buscarla en TMDB
    const nodoExistente = grafoActual.nodes.find(
      (n) =>
        n.title.toLowerCase() === decision.pelicula_origen!.title.toLowerCase(),
    );

    let sourceId = nodoExistente?.id;

    if (!sourceId) {
      const datosOrigenTmdb = await searchTmdb(decision.pelicula_origen.title);
      if (!datosOrigenTmdb) {
        throw new Error(
          `No se encontró la película "${decision.pelicula_origen.title}" en TMDB.`,
        );
      }
      sourceId = datosOrigenTmdb.id;
      lotePeliculas.push({
        movieId: datosOrigenTmdb.id,
        title: datosOrigenTmdb.title,
        poster: datosOrigenTmdb.poster,
        genres: decision.pelicula_origen.genres,
        description:
          decision.pelicula_origen.description || datosOrigenTmdb.overview,
      });
    }

    // Buscar las 3 películas recomendadas en TMDB
    for (const rec of decision.recomendaciones ?? []) {
      const datosRecTmdb = await searchTmdb(rec.title);
      if (datosRecTmdb) {
        lotePeliculas.push({
          movieId: datosRecTmdb.id,
          title: datosRecTmdb.title,
          poster: datosRecTmdb.poster,
          sourceId: sourceId,
          reason: rec.reason,
          genres: rec.genres,
        });
      }
    }

    resultadoOperacion = await addToGraph(lotePeliculas);
  } else if (
    decision.accion === "remove_from_graph" &&
    decision.target_movie_id
  ) {
    resultadoOperacion = await removeFromGraph(decision.target_movie_id);
  } else if (
    decision.accion === "clear_recommendations" &&
    decision.target_movie_id
  ) {
    resultadoOperacion = await clearRecommendations(decision.target_movie_id);
  } else {
    throw new Error(
      "El agente devolvió una acción incompleta o no reconocida.",
    );
  }

  return {
    ok: true,
    skill: decision.skill_invocada,
    accion: decision.accion,
    mensaje: decision.mensaje_confirmacion,
    detalleTecnico: resultadoOperacion,
    telemetria,
  };
}
