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
import type { GraphData } from "./data/interfaces";

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

          const NODE_WIDTH = 310;
          const NODE_GAP_X = 120;
          const ROOT_GAP_X = 280;
          const LEVEL_HEIGHT = 660;
          const layoutCenterX = window.innerWidth / 2;

          const targets = new Set(data.edges.map((edge) => edge.target));
          const layoutRoots = data.nodes.filter((node) => !targets.has(node.id));
          const assignedNodes = new Set<string>();
          const primaryChildren = new Map<string, string[]>();
          const assignTree = (nodeId: string, parentId?: string) => {
            if (assignedNodes.has(nodeId)) return;
            assignedNodes.add(nodeId);

            if (parentId) {
              const children = primaryChildren.get(parentId) ?? [];
              children.push(nodeId);
              primaryChildren.set(parentId, children);
            }

            (childrenMap.get(nodeId) ?? []).forEach((childId) =>
              assignTree(childId, nodeId),
            );
          };

          layoutRoots.forEach((root) => assignTree(root.id));
          data.nodes.forEach((node) => {
            if (assignedNodes.has(node.id)) return;
            layoutRoots.push(node);
            assignTree(node.id);
          });

          const subtreeWidths = new Map<string, number>();
          const getSubtreeWidth = (nodeId: string): number => {
            const cachedWidth = subtreeWidths.get(nodeId);
            if (cachedWidth !== undefined) return cachedWidth;

            const children = primaryChildren.get(nodeId) ?? [];
            const childrenWidth =
              children.reduce(
                (total, childId) => total + getSubtreeWidth(childId),
                0,
              ) +
              Math.max(0, children.length - 1) * NODE_GAP_X;
            const width = Math.max(NODE_WIDTH, childrenWidth);
            subtreeWidths.set(nodeId, width);
            return width;
          };

          const rootGroupWidths = layoutRoots.map((root) => ({
            rootId: root.id,
            width: getSubtreeWidth(root.id),
          }));
          const totalLayoutWidth =
            rootGroupWidths.reduce((total, group) => total + group.width, 0) +
            Math.max(0, rootGroupWidths.length - 1) * ROOT_GAP_X;
          let nextGroupLeft = layoutCenterX - totalLayoutWidth / 2;
          const positions = new Map<string, { x: number; y: number }>();

          const positionTree = (
            nodeId: string,
            centerX: number,
            depth: number,
          ) => {
            positions.set(nodeId, {
              x: centerX - NODE_WIDTH / 2,
              y: 20 + depth * LEVEL_HEIGHT,
            });

            const children = primaryChildren.get(nodeId) ?? [];
            const childrenWidth =
              children.reduce(
                (total, childId) => total + getSubtreeWidth(childId),
                0,
              ) +
              Math.max(0, children.length - 1) * NODE_GAP_X;
            let nextChildLeft = centerX - childrenWidth / 2;

            children.forEach((childId) => {
              const childWidth = getSubtreeWidth(childId);
              positionTree(childId, nextChildLeft + childWidth / 2, depth + 1);
              nextChildLeft += childWidth + NODE_GAP_X;
            });
          };

          rootGroupWidths.forEach((group) => {
            positionTree(
              group.rootId,
              nextGroupLeft + group.width / 2,
              0,
            );
            nextGroupLeft += group.width + ROOT_GAP_X;
          });

          const mappedNodes: Node<MovieNodeData>[] = data.nodes.map((movie) => {
            const position = positions.get(movie.id)!;
            const depth = (position.y - 20) / LEVEL_HEIGHT;
            const hasChildren = (childrenMap.get(movie.id)?.length || 0) > 0;
            const isHighlighted = depth === 0 || hasChildren;
            const desc = descriptionByTarget.get(movie.id) || movie.description;

            return {
              id: movie.id,
              type: "movieCard",
              position,
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
        <WatchlistSidebar {...watchlistCtrl} />
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

        </main>
      )}
    </div>
  );
}
