# 🎬 Motor de Recomendación Visual con IA (Protocolo MCP)

## 📝 Breve descripción del proyecto

Este proyecto tiene como objetivo demostrar el dominio de flujos de trabajo asistidos por IA dentro del entorno de desarrollo, integrando herramientas externas a través del protocolo MCP (Model Context Protocol).

La aplicación consiste en un **Motor de Recomendación de Películas basado en Grafos de Conocimiento**. El proyecto utiliza un Agente de IA en el IDE que, mediante un servidor MCP personalizado, consulta datos reales de The Movie Database (TMDB) y actualiza de forma autónoma una base de datos local de relaciones (JSON). El frontend, desarrollado en React con React Flow, lee esta base local mediante una estrategia de _polling_ asíncrono y renderiza el árbol jerárquico de películas, sus metadatos (géneros, sinopsis) y sus conexiones lógicas en tiempo real.

## 🧠 Core del Proyecto: Herramientas MCP y Arquitectura

El núcleo de este trabajo reside en el servidor MCP local, construido sobre las clases `McpServer` y `StdioServerTransport` del `@modelcontextprotocol/sdk`. Esto permite la comunicación estándar (stdio) entre el IDE y nuestro código Node.js.

Se definieron tres herramientas (`tools`) validadas estrictamente con `zod` para que el Agente interactúe de forma autónoma y sin alucinaciones:

1. **`read_graph` (Lectura de Estado):** Le permite al Agente leer el archivo `graph_data.json` local mediante `fs.readFile`. Es el "contexto de memoria" de la IA: antes de recomendar, usa esta herramienta para saber qué películas ya existen en el lienzo y de dónde debe colgar las nuevas conexiones.
2. **`search_tmdb` (Extracción de Datos):** El puente hacia el mundo real. Recibe el nombre de una película validado por `zod` y ejecuta una petición HTTP asíncrona (`fetch`) a la API REST de TMDB (`api.themoviedb.org/3/search/movie`). El servidor filtra la respuesta cruda y le devuelve a la IA un objeto limpio con el ID oficial, título, sinopsis (`overview`) y la URL del póster renderizado, garantizando precisión absoluta en los datos visuales.
3. **`add_to_graph` (Persistencia por Lotes):** Herramienta de escritura estructurada. Utiliza una arquitectura de lotes (_batching_) exigiendo un array (`z.array`) que contiene tanto la película inicial como sus recomendaciones. La función procesa los nodos y aristas (`edges`) en memoria y ejecuta una única escritura asíncrona con `fs.writeFile`. Esto previene condiciones de carrera (_race conditions_) y colapsos de estado en el _polling_ del frontend de React.

## ⚙️ Requisitos previos para ejecutarlo

Para ejecutar este proyecto en tu entorno local, necesitas tener instalado:

- **Node.js**: Versión 20 LTS (Recomendada).
- **Gestor de paquetes**: `npm` (viene incluido con Node).
- **Editor de Código**: Visual Studio Code.
- **Extensión MCP (Cliente)**: GitHub Copilot, Roo Code o Cline configurado para leer servidores MCP locales.
- **API Key**: Clave de acceso a [The Movie Database (TMDB)](https://developer.themoviedb.org/docs/getting-started).
- **Navegador Web**: Chrome, Firefox o Edge.

## 🚀 Estructura del Repositorio

Todo el código se encuentra centralizado en este único repositorio para evitar la dispersión de archivos:

- `/frontend`: Aplicación cliente creada con React, Vite y React Flow. Incluye el motor de renderizado posicional jerárquico.
- `/mcp-server`: Servidor MCP local desarrollado en TypeScript con `@modelcontextprotocol/sdk`. Implementa operaciones de _batching_ para optimizar la escritura en disco.
- `.vscode/mcp.json`: Archivo de configuración para conectar el cliente MCP del IDE con el servidor local.
- `.github/copilot-instructions.md`: Sistema de reglas y protocolos estrictos para condicionar el comportamiento secuencial del Agente de IA.
- `frontend/src/data/graph_data.json`: Archivo de persistencia local que actúa como puente de estado reactivo entre el Agente MCP y la interfaz visual.
- `frontend/src/data/watchlist_data.json`: Archivo de persistencia de la watchlist, compartido por la interfaz y disponible para futuras herramientas de agentes.

## 🛠️ Instrucciones de instalación

### 1. Configuración de la API Key (TMDB)

Para que el servidor MCP pueda buscar las películas reales, es obligatorio configurar tu clave de TMDB.

1. Ingresa a la carpeta del servidor: `cd mcp-server`
2. Crea un archivo llamado `.env` en la raíz de esa carpeta. Existe un archivo `.env.example` para poder tomar de referencia.
3. Agrega tu clave de la siguiente manera:

```env
TMDB_API_KEY=tu_clave_aqui
```

### 2. Instalación y ejecución del Servidor MCP

Abre una terminal en la raíz del proyecto y ejecuta los siguientes comandos para instalar las dependencias y compilar el servidor que utilizará la IA:

```bash
cd mcp-server
npm install
npm run build
```

### 3. Instalación y ejecución del Frontend

Abre una segunda terminal en la raíz del proyecto para levantar la interfaz visual de React donde veremos el grafo interactivo:

```bash
cd frontend
npm install
npm run dev
```

El frontend estará disponible localmente para visualizar en `http://localhost:5173` por defecto.
El servidor de desarrollo de Vite también expone una API local para leer y guardar `watchlist_data.json`; la interfaz usa esa API en lugar de `localStorage`.

La watchlist usa únicamente `watchlist_data.json`; no se lee ni se migra información desde `localStorage`. Si el JSON está vacío, la watchlist comienza vacía (`[]`). Las operaciones de agregar, quitar, marcar como vista y sincronizar con las películas del grafo se guardan en el JSON.

### 4. Inicialización del Agente en VS Code

1. Recarga la ventana de Visual Studio Code (`Developer: Reload Window`) para que la extensión de IA lea el archivo `.vscode/mcp.json` y conecte el servidor local.
2. Verifica en tu panel de chat (ej. Copilot Edits) que las herramientas `search_tmdb` y `add_to_graph` estén detectadas y disponibles.
3. Asegúrate de que el archivo `frontend/src/data/graph_data.json` esté inicializado con la estructura básica vacía:

```json
{
  "nodes": [],
  "edges": []
}
```

El archivo `frontend/src/data/watchlist_data.json` debe contener un array JSON, por ejemplo `[]` cuando no haya películas guardadas.

## 🤖 Uso y Ejecución de la Demostración

El Agente está entrenado para procesar comandos complejos en una sola ejecución gracias al protocolo de _batching_. Para observar el flujo completo de toma de decisiones, extracción de datos, escritura en disco y renderizado dinámico, abre el chat del IDE y utiliza un prompt estructurado como este:

> "Recomendame películas como Interstellar"
