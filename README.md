# 🎬 Motor de Recomendación Visual con IA

## 📝 Descripción

Aplicación para explorar recomendaciones de películas mediante un grafo visual. El frontend está construido con React, Vite y React Flow. El agente CuradorGrafo consulta Gemini para interpretar los pedidos, busca películas en TMDB y actualiza el grafo local en `frontend/src/data/graph_data.json`.

El agente se ejecuta en el backend de Node.js y se invoca desde la interfaz a través del endpoint local `POST /api/agente`. No se utiliza un servidor MCP en el flujo actual.

## 🧠 Arquitectura

- `.github/agents/curador_grafo.agent.md`: define el rol, las reglas y las skills de creación y eliminación del agente.
- `frontend/src/components/InputBar.tsx`: envía el pedido del usuario a `/api/agente` y muestra el estado y la respuesta.
- `frontend/vite.config.ts`: implementa el endpoint local del agente y la API de persistencia de la watchlist.
- `backend/src/agente_curador_nube.ts`: lee el grafo y las instrucciones del agente, consulta Gemini y ejecuta la acción solicitada.
- `backend/src/graph_tools.ts`: contiene las operaciones para leer, buscar, agregar y eliminar películas del grafo. Las búsquedas de títulos usan TMDB.
- `frontend/src/data/graph_data.json`: persistencia local del grafo de películas.
- `frontend/src/data/watchlist_data.json`: persistencia local de la watchlist.

Para agregar recomendaciones, el backend guarda la película de origen y sus recomendaciones en el grafo. Para eliminar una película, puede eliminar también sus ramas; para limpiar recomendaciones, conserva la película original.

## ⚙️ Requisitos

- Node.js 20 LTS o superior y npm.
- Una clave de API de [Google Gemini](https://aistudio.google.com/app/apikey).
- Una clave de API de [The Movie Database (TMDB)](https://developer.themoviedb.org/docs/getting-started).
- Un navegador web moderno.

## 🛠️ Instalación y configuración

### 1. Instalar dependencias del frontend y del backend

Los paquetes tienen dependencias y carpetas `node_modules` independientes. Ejecuta `npm install` en cada carpeta:

```powershell
cd frontend
npm install
cd ..\backend
npm install
cd ..
```

### 2. Configurar las claves de API

Crea `backend/.env` a partir de `backend/.env.example` y agrega tus claves:

```env
GEMINI_API_KEY=tu_clave_de_gemini
TMDB_API_KEY=tu_clave_de_tmdb
```

No compartas ni subas este archivo con claves reales al repositorio.

### 3. Inicializar los datos

Verifica que `frontend/src/data/graph_data.json` tenga una estructura de grafo válida:

```json
{
  "nodes": [],
  "edges": []
}
```

La watchlist debe ser un array JSON. Para comenzar sin películas guardadas, usa:

```json
[]
```

### 4. Abrir y ejecutar el proyecto en Visual Studio Code

1. Abre en VS Code la carpeta raíz del repositorio (la carpeta que contiene `frontend`, `backend` y `.github`).
2. Configura `backend/.env` con las claves de Gemini y TMDB antes de iniciar la aplicación.
3. En VS Code, abre **Terminal > Nueva terminal**.
4. En la terminal integrada, ejecuta:

```powershell
cd frontend
npm run dev
```

Vite muestra en esa terminal la dirección local de la aplicación, normalmente `http://localhost:5173`. Deja la terminal abierta mientras la usas.

No hace falta iniciar el backend en otra terminal: Vite atiende `/api/agente` y carga el código del agente cuando la interfaz lo invoca. Tampoco hace falta configurar MCP para este flujo. El archivo `.github/agents/curador_grafo.agent.md` contiene las instrucciones que usa el backend.

## 🤖 Uso

Escribe un pedido en la barra de búsqueda, por ejemplo:

> Recomendar películas como Interstellar

También puedes pedir que se elimine una película o que se borren solo sus recomendaciones. La respuesta del agente aparece debajo de la barra y el grafo se actualiza al detectar cambios en `graph_data.json`.

La watchlist se consulta y guarda a través de la API local de Vite; no se lee ni se migra información desde `localStorage`.
