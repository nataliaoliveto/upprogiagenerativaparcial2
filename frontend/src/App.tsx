import { useEffect, useMemo, useRef, useState } from "react";
import ReactFlow, {
  MarkerType,
  type Edge,
  type Node,
  type NodeProps,
} from "reactflow";
import "reactflow/dist/style.css";

import { InputBar } from "./components/InputBar";
import { MovieCardNode, type MovieNodeData } from "./components/MovieCardNode";
import { WatchlistSidebar } from "./components/WatchlistSidebar";
import { useWatchlist } from "./hooks/useWatchlist";
import type { GraphData, GraphMovie } from "./data/interfaces";

export default function App() {
  const [graphNodes, setGraphNodes] = useState<Node<MovieNodeData>[]>([]);
  const [movieEdges, setMovieEdges] = useState<Edge[]>([]);
  const [graphRevision, setGraphRevision] = useState(0);
  const [lastSearch, setLastSearch] = useState("");
  const graphSnapshotRef = useRef<string | null>(null);

  const watchlistCtrl = useWatchlist();
  const { syncWatchlistWithGraph } = watchlistCtrl;

  const movieNodeTypes = useMemo(
    () => ({
      movieCard: (props: NodeProps<MovieNodeData>) => (
        <MovieCardNode
          {...props}
          watchlist={watchlistCtrl.watchlist}
          watchlistReady={watchlistCtrl.isLoaded}
          onToggleWatchlist={watchlistCtrl.toggleWatchlist}
        />
      ),
    }),
    [
      watchlistCtrl.isLoaded,
      watchlistCtrl.toggleWatchlist,
      watchlistCtrl.watchlist,
    ],
  );

  useEffect(() => {
    const fetchAndUpdateGraph = () => {
      fetch("/src/data/graph_data.json?t=" + new Date().getTime())
        .then((res) => {
          if (!res.ok) {
            throw new Error(`Error al leer el grafo: ${res.status}`);
          }
          return res.json() as Promise<GraphData>;
        })
        .then((data: GraphData) => {
          if (
            !data ||
            !Array.isArray(data.nodes) ||
            !Array.isArray(data.edges)
          ) {
            throw new Error("El archivo del grafo tiene un formato inválido.");
          }

          syncWatchlistWithGraph(data.nodes);
          const graphSnapshot = JSON.stringify(data);
          if (graphSnapshot === graphSnapshotRef.current) return;
          graphSnapshotRef.current = graphSnapshot;
          setGraphRevision((revision) => revision + 1);

          if (data.nodes.length === 0) {
            setGraphNodes([]);
            setMovieEdges([]);
            return;
          }

          const descriptionByTarget = new Map<string, string>();
          const childrenMap = new Map<string, string[]>();

          data.edges.forEach((edge) => {
            if (edge.label) descriptionByTarget.set(edge.target, edge.label);
            if (!childrenMap.has(edge.source)) childrenMap.set(edge.source, []);
            childrenMap.get(edge.source)!.push(edge.target);
          });

          const targets = new Set(data.edges.map((edge) => edge.target));
          const layoutRoots = data.nodes.filter((node) => !targets.has(node.id));
          if (layoutRoots.length === 0 && data.nodes.length > 0) {
            layoutRoots.push(data.nodes[0]);
          }

          const rootByNode = new Map<string, string>();
          const nodeDepths = new Map<string, number>();
          const assignReachableNodes = (rootId: string) => {
            const queue = [{ id: rootId, depth: 0 }];
            while (queue.length > 0) {
              const current = queue.shift()!;
              if (rootByNode.has(current.id)) continue;

              rootByNode.set(current.id, rootId);
              nodeDepths.set(current.id, current.depth);
              (childrenMap.get(current.id) ?? []).forEach((childId) => {
                queue.push({ id: childId, depth: current.depth + 1 });
              });
            }
          };

          layoutRoots.forEach((root) => assignReachableNodes(root.id));
          data.nodes.forEach((node) => {
            if (rootByNode.has(node.id)) return;
            layoutRoots.push(node);
            assignReachableNodes(node.id);
          });

          const NODE_WIDTH = 310;
          const NODE_GAP_X = 120;
          const ROOT_GAP_X = 280;
          const LEVEL_HEIGHT = 660;
          const layoutCenterX = window.innerWidth / 2;

          const nodesByRootAndDepth = new Map<
            string,
            Map<number, GraphMovie[]>
          >();
          data.nodes.forEach((node) => {
            const rootId = rootByNode.get(node.id)!;
            const depth = nodeDepths.get(node.id) ?? 0;
            let nodesByDepth = nodesByRootAndDepth.get(rootId);
            if (!nodesByDepth) {
              nodesByDepth = new Map();
              nodesByRootAndDepth.set(rootId, nodesByDepth);
            }
            const nodesAtDepth = nodesByDepth.get(depth) ?? [];
            nodesAtDepth.push(node);
            nodesByDepth.set(depth, nodesAtDepth);
          });

          const rootGroupWidths = layoutRoots.map((root) => {
            const nodesByDepth = nodesByRootAndDepth.get(root.id)!;
            const widestLevel = Math.max(
              ...Array.from(nodesByDepth.values(), (nodesAtDepth) =>
                nodesAtDepth.length * NODE_WIDTH +
                Math.max(0, nodesAtDepth.length - 1) * NODE_GAP_X,
              ),
            );
            return { rootId: root.id, width: widestLevel };
          });
          const totalLayoutWidth =
            rootGroupWidths.reduce((total, group) => total + group.width, 0) +
            Math.max(0, rootGroupWidths.length - 1) * ROOT_GAP_X;
          let nextGroupLeft = layoutCenterX - totalLayoutWidth / 2;
          const rootGroupLefts = new Map<string, number>();
          rootGroupWidths.forEach((group) => {
            rootGroupLefts.set(group.rootId, nextGroupLeft);
            nextGroupLeft += group.width + ROOT_GAP_X;
          });

          const mappedNodes: Node<MovieNodeData>[] = data.nodes.map((movie) => {
            const rootId = rootByNode.get(movie.id)!;
            const depth = nodeDepths.get(movie.id) || 0;
            const nodesByDepth = nodesByRootAndDepth.get(rootId)!;
            const levelNodes = nodesByDepth.get(depth)!;
            const indexInLevel = levelNodes.findIndex((n) => n.id === movie.id);
            const levelWidth =
              levelNodes.length * NODE_WIDTH +
              Math.max(0, levelNodes.length - 1) * NODE_GAP_X;
            const groupWidth = rootGroupWidths.find(
              (group) => group.rootId === rootId,
            )!.width;
            const x =
              rootGroupLefts.get(rootId)! +
              (groupWidth - levelWidth) / 2 +
              indexInLevel * (NODE_WIDTH + NODE_GAP_X);
            const y = 20 + depth * LEVEL_HEIGHT;

            const hasChildren = (childrenMap.get(movie.id)?.length || 0) > 0;
            const isHighlighted = depth === 0 || hasChildren;
            const desc = descriptionByTarget.get(movie.id) || movie.description;

            return {
              id: movie.id,
              type: "movieCard",
              position: { x, y },
              data: {
                title: movie.title,
                poster: movie.poster,
                description: desc,
                genres: movie.genres,
              },
              style: isHighlighted
                ? {
                    boxShadow:
                      "0 0 0 1px rgba(125, 211, 252, 0.55), 0 0 24px rgba(59, 130, 246, 0.42)",
                  }
                : {},
            };
          });

          const mappedEdges: Edge[] = data.edges.map((edge) => ({
            id: edge.id,
            source: String(edge.source),
            target: String(edge.target),
            animated: true,
            type: "smoothstep",
            style: { stroke: "#7dd3fc", strokeWidth: 1.5, opacity: 0.85 },
            markerEnd: {
              type: MarkerType.ArrowClosed,
              color: "#7dd3fc",
              width: 12,
              height: 12,
            },
            sourceHandle: "bottom",
            targetHandle: "top",
          }));

          setGraphNodes(mappedNodes);
          setMovieEdges(mappedEdges);
        })
        .catch((err) => console.log("Esperando datos...", err));
    };

    fetchAndUpdateGraph();
    const intervalo = setInterval(fetchAndUpdateGraph, 1000);
    return () => clearInterval(intervalo);
  }, [syncWatchlistWithGraph]);

  return (
    <div
      style={{
        width: "100vw",
        height: "100vh",
        margin: 0,
        padding: 0,
        background: "#0f172a",
        color: "#f8fafc",
        boxSizing: "border-box",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <header
        style={{
          position: "relative",
          zIndex: 10,
          padding: "18px 24px 12px",
          background: "#0f172a",
          width: "100%",
          boxSizing: "border-box",
          flexShrink: 0,
        }}
      >
        <h1
          style={{
            margin: 0,
            fontSize: 22,
            fontWeight: 700,
            letterSpacing: "0.2px",
            color: "#f8fafc",
            textAlign: "left",
          }}
        >
          Recomendaciones similares de películas
        </h1>
        <p
          aria-live="polite"
          style={{
            marginTop: 4,
            color: "#94a3b8",
            fontSize: 13,
            textAlign: "left",
          }}
        >
          Última búsqueda: {lastSearch || "Ninguna"}
        </p>
        <InputBar
          hasMovies={graphNodes.length > 0}
          graphRevision={graphRevision}
          onSearch={setLastSearch}
        />
      </header>

      {graphNodes.length === 0 ? (
        <main
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 12,
            padding: 24,
          }}
        >
          {watchlistCtrl.watchlistError && (
            <p role="alert" style={{ color: "#fca5a5", textAlign: "center" }}>
              No se pudo cargar la watchlist: {watchlistCtrl.watchlistError}
            </p>
          )}
          <p
            style={{
              color: "#f8fafc",
              textAlign: "center",
              fontSize: 18,
              fontWeight: "bold",
            }}
          >
            Bienvenida a la búsqueda de recomendaciones de películas
            <br />
            Pídele al agente recomendaciones según alguna película que te haya
            gustado
          </p>
        </main>
      ) : (
        <main
          style={{ position: "relative", flex: 1, minHeight: 0, width: "100%" }}
        >
          <ReactFlow
            nodes={graphNodes}
            edges={movieEdges}
            nodeTypes={movieNodeTypes}
            fitView
            fitViewOptions={{ padding: 0.45, minZoom: 0.65, maxZoom: 1.2 }}
            proOptions={{ hideAttribution: true }}
            defaultEdgeOptions={{ type: "smoothstep" }}
            nodesDraggable={false}
            nodesConnectable={false}
            elementsSelectable={false}
            panOnDrag={true}
            zoomOnScroll={true}
            minZoom={0.6}
            maxZoom={1.5}
            style={{ background: "#0f172a", width: "100%", height: "100%" }}
          />

          <WatchlistSidebar {...watchlistCtrl} />
        </main>
      )}
    </div>
  );
}
