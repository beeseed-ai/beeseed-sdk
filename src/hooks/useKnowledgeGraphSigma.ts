import { useRef, useEffect, useCallback, useState, type RefObject } from 'react'
import Sigma from 'sigma'
import Graph from 'graphology'
import FA2Layout from 'graphology-layout-forceatlas2/worker'
import forceAtlas2 from 'graphology-layout-forceatlas2'
import noverlap from 'graphology-layout-noverlap'
import EdgeCurveProgram from '@sigma/edge-curve'

// ── Color helpers (from GitNexus) ──

const hexToRgb = (hex: string): { r: number; g: number; b: number } => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  return result
    ? { r: parseInt(result[1], 16), g: parseInt(result[2], 16), b: parseInt(result[3], 16) }
    : { r: 100, g: 100, b: 100 }
}

const rgbToHex = (r: number, g: number, b: number): string =>
  '#' +
  [r, g, b]
    .map((x) => {
      const h = Math.max(0, Math.min(255, Math.round(x))).toString(16)
      return h.length === 1 ? '0' + h : h
    })
    .join('')

export const dimColor = (hex: string, amount: number): string => {
  const rgb = hexToRgb(hex)
  const bg = { r: 245, g: 245, b: 245 } // #f5f5f5 light background
  return rgbToHex(
    bg.r + (rgb.r - bg.r) * amount,
    bg.g + (rgb.g - bg.g) * amount,
    bg.b + (rgb.b - bg.b) * amount,
  )
}

export const brightenColor = (hex: string, factor: number): string => {
  const rgb = hexToRgb(hex)
  return rgbToHex(
    rgb.r + ((255 - rgb.r) * (factor - 1)) / factor,
    rgb.g + ((255 - rgb.g) * (factor - 1)) / factor,
    rgb.b + ((255 - rgb.b) * (factor - 1)) / factor,
  )
}

// ── FA2 settings (adapted from GitNexus) ──

const getFA2Settings = (nodeCount: number) => {
  const isSmall = nodeCount < 200
  const isMedium = nodeCount >= 200 && nodeCount < 1000

  return {
    gravity: isSmall ? 1.5 : isMedium ? 1 : 0.8,
    scalingRatio: isSmall ? 12 : isMedium ? 25 : 50,
    slowDown: isSmall ? 3 : isMedium ? 5 : 8,
    barnesHutOptimize: nodeCount > 100,
    barnesHutTheta: 0.5,
    strongGravityMode: false,
    outboundAttractionDistribution: true,
    linLogMode: false,
    adjustSizes: true,
    edgeWeightInfluence: 1,
  }
}

const getLayoutDuration = (nodeCount: number): number => {
  if (nodeCount > 2000) return 2000
  if (nodeCount > 500) return 1500
  return 1000
}

const NOVERLAP_SETTINGS = {
  maxIterations: 10,
  ratio: 1.05,
  margin: 5,
  expansion: 1.02,
}

// Animate from current positions to target positions over duration ms
function animatePositions(
  graph: Graph,
  targets: Map<string, { x: number; y: number }>,
  sigma: Sigma,
  duration: number,
) {
  const starts = new Map<string, { x: number; y: number }>()
  graph.forEachNode((node, attrs) => {
    starts.set(node, { x: attrs.x, y: attrs.y })
  })

  const t0 = performance.now()
  const step = () => {
    const elapsed = performance.now() - t0
    const progress = Math.min(elapsed / duration, 1)
    // ease-out cubic
    const t = 1 - Math.pow(1 - progress, 3)

    graph.forEachNode((node) => {
      const s = starts.get(node)
      const e = targets.get(node)
      if (s && e) {
        graph.setNodeAttribute(node, 'x', s.x + (e.x - s.x) * t)
        graph.setNodeAttribute(node, 'y', s.y + (e.y - s.y) * t)
      }
    })
    sigma.refresh()

    if (progress < 1) requestAnimationFrame(step)
  }
  requestAnimationFrame(step)
}

// ── Hook interface ──

interface UseKnowledgeGraphSigmaOptions {
  onNodeClick?: (nodeId: string) => void
  onNodeHover?: (nodeId: string | null) => void
  onStageClick?: () => void
  focusViewportPaddingRight?: number
}

interface UseKnowledgeGraphSigmaReturn {
  containerRef: RefObject<HTMLDivElement | null>
  sigmaRef: RefObject<Sigma | null>
  setGraph: (graph: Graph) => void
  zoomIn: () => void
  zoomOut: () => void
  resetZoom: () => void
  focusNode: (nodeId: string) => void
  isLayoutRunning: boolean
  startLayout: () => void
  stopLayout: () => void
  selectedNode: string | null
  setSelectedNode: (nodeId: string | null) => void
  edgesHidden: boolean
  setEdgesHidden: (hidden: boolean) => void
}

export const useKnowledgeGraphSigma = (
  options: UseKnowledgeGraphSigmaOptions = {},
): UseKnowledgeGraphSigmaReturn => {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const sigmaRef = useRef<Sigma | null>(null)
  const graphRef = useRef<Graph | null>(null)
  const layoutRef = useRef<FA2Layout | null>(null)
  const selectedNodeRef = useRef<string | null>(null)
  const edgesHiddenRef = useRef(false)
  const layoutTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [isLayoutRunning, setIsLayoutRunning] = useState(false)
  const [selectedNode, setSelectedNodeState] = useState<string | null>(null)
  const [edgesHidden, setEdgesHiddenState] = useState(false)

  const finishLayout = useCallback(() => {
    if (layoutTimeoutRef.current) {
      clearTimeout(layoutTimeoutRef.current)
      layoutTimeoutRef.current = null
    }

    const layout = layoutRef.current
    layoutRef.current = null

    try {
      layout?.stop()
      const graph = graphRef.current
      const sigma = sigmaRef.current
      if (layout && graph && sigma) {
        noverlap.assign(graph, NOVERLAP_SETTINGS)
        sigma.refresh()
      }
    } finally {
      setIsLayoutRunning(false)
    }
  }, [])

  const setSelectedNode = useCallback((nodeId: string | null) => {
    selectedNodeRef.current = nodeId
    setSelectedNodeState(nodeId)
    const sigma = sigmaRef.current
    if (!sigma) return
    sigma.refresh()
  }, [])

  const setEdgesHidden = useCallback((hidden: boolean) => {
    edgesHiddenRef.current = hidden
    setEdgesHiddenState(hidden)
    sigmaRef.current?.refresh()
  }, [])

  // Initialize Sigma ONCE
  useEffect(() => {
    if (!containerRef.current) return

    const graph = new Graph()
    graphRef.current = graph

    const sigma = new Sigma(graph, containerRef.current, {
      allowInvalidContainer: true,
      renderLabels: true,
      labelFont: 'JetBrains Mono, Inter, system-ui, sans-serif',
      labelSize: 11,
      labelWeight: '500',
      labelColor: { color: '#444444' },
      labelRenderedSizeThreshold: 8,
      labelDensity: 0.1,
      labelGridCellSize: 70,

      defaultNodeColor: '#6366f1',
      defaultEdgeColor: '#999999',

      defaultEdgeType: 'curved',
      edgeProgramClasses: {
        curved: EdgeCurveProgram,
      },

      // Dark hover tooltip with glow ring (from GitNexus)
      defaultDrawNodeHover: (context, data, settings) => {
        const label = data.label
        if (!label) return

        const size = settings.labelSize || 11
        const font = settings.labelFont || 'JetBrains Mono, Inter, system-ui, sans-serif'
        const weight = settings.labelWeight || '500'

        context.font = `${weight} ${size}px ${font}`
        const textWidth = context.measureText(label).width

        const nodeSize = data.size || 8
        const x = data.x
        const y = data.y - nodeSize - 10
        const paddingX = 8
        const paddingY = 5
        const height = size + paddingY * 2
        const width = textWidth + paddingX * 2
        const radius = 4

        // Light background pill
        context.fillStyle = '#ffffff'
        context.beginPath()
        context.roundRect(x - width / 2, y - height / 2, width, height, radius)
        context.fill()

        // Border matching node color
        context.strokeStyle = data.color || '#6366f1'
        context.lineWidth = 2
        context.stroke()

        // Label text
        context.fillStyle = '#1a1a1a'
        context.textAlign = 'center'
        context.textBaseline = 'middle'
        context.fillText(label, x, y)

        // Glow ring around node
        context.beginPath()
        context.arc(data.x, data.y, nodeSize + 4, 0, Math.PI * 2)
        context.strokeStyle = data.color || '#6366f1'
        context.lineWidth = 2
        context.globalAlpha = 0.5
        context.stroke()
        context.globalAlpha = 1
      },

      minCameraRatio: 0.002,
      maxCameraRatio: 50,
      hideEdgesOnMove: true,
      zIndex: true,
      stagePadding: 30,

      // Node reducer: click-to-highlight neighbors
      nodeReducer: (node, data) => {
        const res = { ...data }
        const currentSelected = selectedNodeRef.current
        if (!currentSelected) return res

        const graph = graphRef.current
        if (!graph) return res

        const isSelected = node === currentSelected
        const isNeighbor = graph.hasEdge(node, currentSelected) || graph.hasEdge(currentSelected, node)

        if (isSelected) {
          res.color = data.color
          res.size = (data.size || 8) * 1.8
          res.zIndex = 2
          res.highlighted = true
          res.forceLabel = true
        } else if (isNeighbor) {
          res.color = data.color
          res.size = (data.size || 8) * 1.3
          res.zIndex = 1
          res.forceLabel = true
        } else {
          res.color = dimColor(data.color, 0.4)
          res.size = (data.size || 8) * 0.7
          res.zIndex = 0
          res.label = ''
        }

        return res
      },

      // Edge reducer: highlight connected edges + hide toggle
      edgeReducer: (edge, data) => {
        const res = { ...data }
        const currentSelected = selectedNodeRef.current
        const hidden = edgesHiddenRef.current

        const graph = graphRef.current
        if (!graph) return res

        const [source, target] = graph.extremities(edge)

        if (currentSelected) {
          const isConnected = source === currentSelected || target === currentSelected
          if (isConnected) {
            res.hidden = false
            res.color = brightenColor(data.color, 1.3)
            res.size = Math.max(1.5, (data.size || 1) * 2.5)
            res.zIndex = 2
          } else {
            res.hidden = true
            res.color = dimColor(data.color, 0.2)
            res.size = 0.4
            res.zIndex = 0
          }
        } else if (hidden) {
          res.hidden = true
        }

        return res
      },
    })

    sigmaRef.current = sigma

    sigma.on('clickNode', ({ node }) => {
      setSelectedNode(node)
      options.onNodeClick?.(node)
    })

    sigma.on('clickStage', () => {
      setSelectedNode(null)
      options.onStageClick?.()
    })

    sigma.on('enterNode', ({ node }) => {
      options.onNodeHover?.(node)
      if (containerRef.current) containerRef.current.style.cursor = 'pointer'
    })

    sigma.on('leaveNode', () => {
      options.onNodeHover?.(null)
      if (containerRef.current) containerRef.current.style.cursor = 'grab'
    })

    return () => {
      if (layoutTimeoutRef.current) clearTimeout(layoutTimeoutRef.current)
      layoutRef.current?.kill()
      sigma.kill()
      sigmaRef.current = null
      graphRef.current = null
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Run FA2 layout via Web Worker
  const runLayout = useCallback((graph: Graph) => {
    const nodeCount = graph.order
    if (nodeCount === 0) {
      setIsLayoutRunning(false)
      return
    }

    // Kill existing layout
    if (layoutRef.current) {
      layoutRef.current.kill()
      layoutRef.current = null
    }
    if (layoutTimeoutRef.current) {
      clearTimeout(layoutTimeoutRef.current)
      layoutTimeoutRef.current = null
    }

    const inferredSettings = forceAtlas2.inferSettings(graph)
    const customSettings = getFA2Settings(nodeCount)
    const settings = { ...inferredSettings, ...customSettings }

    const layout = new FA2Layout(graph, { settings })
    layoutRef.current = layout
    layout.start()
    setIsLayoutRunning(true)

    const duration = getLayoutDuration(nodeCount)

    layoutTimeoutRef.current = setTimeout(() => {
      layoutTimeoutRef.current = null
      if (layoutRef.current === layout) {
        layoutRef.current = null

        try {
          layout.stop()
          // Snapshot current positions (FA2's result)
          const beforePositions = new Map<string, { x: number; y: number }>()
          graph.forEachNode((node, attrs) => {
            beforePositions.set(node, { x: attrs.x, y: attrs.y })
          })

          // Compute noverlap target positions on a copy, then animate
          noverlap.assign(graph, NOVERLAP_SETTINGS)
          const afterPositions = new Map<string, { x: number; y: number }>()
          graph.forEachNode((node, attrs) => {
            afterPositions.set(node, { x: attrs.x, y: attrs.y })
          })

          // Restore FA2 positions, then animate to noverlap result
          graph.forEachNode((node) => {
            const pos = beforePositions.get(node)
            if (pos) {
              graph.setNodeAttribute(node, 'x', pos.x)
              graph.setNodeAttribute(node, 'y', pos.y)
            }
          })

          const sigma = sigmaRef.current
          if (sigma) {
            animatePositions(graph, afterPositions, sigma, 600)
          }
        } finally {
          setIsLayoutRunning(false)
        }
      }
    }, duration)
  }, [])

  const setGraph = useCallback(
    (newGraph: Graph) => {
      const sigma = sigmaRef.current
      if (!sigma) return

      // Kill existing layout
      if (layoutRef.current) {
        layoutRef.current.kill()
        layoutRef.current = null
      }
      if (layoutTimeoutRef.current) {
        clearTimeout(layoutTimeoutRef.current)
        layoutTimeoutRef.current = null
      }
      setIsLayoutRunning(false)

      graphRef.current = newGraph
      sigma.setGraph(newGraph)
      setSelectedNode(null)

      runLayout(newGraph)
      sigma.getCamera().animatedReset({ duration: 500 })
    },
    [runLayout, setSelectedNode],
  )

  const focusNode = useCallback(
    (nodeId: string) => {
      const sigma = sigmaRef.current
      const graph = graphRef.current
      if (!sigma || !graph || !graph.hasNode(nodeId)) return

      const alreadySelected = selectedNodeRef.current === nodeId
      selectedNodeRef.current = nodeId
      setSelectedNodeState(nodeId)

      if (!alreadySelected) {
        finishLayout()

        const attrs = graph.getNodeAttributes(nodeId)

        // Collect node + all neighbors
        let nMinX = attrs.x, nMaxX = attrs.x, nMinY = attrs.y, nMaxY = attrs.y
        graph.forEachNeighbor(nodeId, (_, na) => {
          if (na.x < nMinX) nMinX = na.x
          if (na.x > nMaxX) nMaxX = na.x
          if (na.y < nMinY) nMinY = na.y
          if (na.y > nMaxY) nMaxY = na.y
        })

        // Full graph bounding box
        let gMinX = Infinity, gMaxX = -Infinity, gMinY = Infinity, gMaxY = -Infinity
        graph.forEachNode((_, a) => {
          if (a.x < gMinX) gMinX = a.x
          if (a.x > gMaxX) gMaxX = a.x
          if (a.y < gMinY) gMinY = a.y
          if (a.y > gMaxY) gMaxY = a.y
        })

        const neighborSpan = Math.max(nMaxX - nMinX, nMaxY - nMinY)
        const graphSpan = Math.max(gMaxX - gMinX, gMaxY - gMinY, 1)

        // ratio = fraction of graph to show; 1.3x padding for breathing room
        const ratio = Math.min(Math.max((neighborSpan / graphSpan) * 1.3, 0.1), 0.85)

        // Convert raw graph coords to sigma's normalized camera space
        // Sigma normalizes: center=(0.5,0.5), span=max(width,height)
        const graphCenterX = (gMinX + gMaxX) / 2
        const graphCenterY = (gMinY + gMaxY) / 2
        let camX = 0.5 + (attrs.x - graphCenterX) / graphSpan
        let camY = 0.5 + (attrs.y - graphCenterY) / graphSpan

        const rightPadding = Math.max(0, options.focusViewportPaddingRight || 0)
        const dimensions = sigma.getDimensions()
        if (rightPadding > 0 && dimensions.width > rightPadding + 120) {
          const targetViewport = {
            x: (dimensions.width - rightPadding) / 2,
            y: dimensions.height / 2,
          }
          const graphAtTarget = sigma.viewportToGraph(targetViewport, {
            cameraState: { x: camX, y: camY, ratio, angle: 0 },
          })
          const targetCamX = 2 * camX - (0.5 + (graphAtTarget.x - graphCenterX) / graphSpan)
          const targetCamY = 2 * camY - (0.5 + (graphAtTarget.y - graphCenterY) / graphSpan)

          if (Number.isFinite(targetCamX) && Number.isFinite(targetCamY)) {
            camX = targetCamX
            camY = targetCamY
          }
        }

        sigma.getCamera().animate({ x: camX, y: camY, ratio }, { duration: 400 })
      }

      sigma.refresh()
    },
    [finishLayout, options.focusViewportPaddingRight],
  )

  const zoomIn = useCallback(() => {
    sigmaRef.current?.getCamera().animatedZoom({ duration: 200 })
  }, [])

  const zoomOut = useCallback(() => {
    sigmaRef.current?.getCamera().animatedUnzoom({ duration: 200 })
  }, [])

  const resetZoom = useCallback(() => {
    sigmaRef.current?.getCamera().animatedReset({ duration: 300 })
    setSelectedNode(null)
  }, [setSelectedNode])

  const startLayout = useCallback(() => {
    const graph = graphRef.current
    if (!graph || graph.order === 0) return
    runLayout(graph)
  }, [runLayout])

  const stopLayout = useCallback(() => {
    if (layoutTimeoutRef.current) {
      clearTimeout(layoutTimeoutRef.current)
      layoutTimeoutRef.current = null
    }
    try {
      if (layoutRef.current) {
        layoutRef.current.stop()
        layoutRef.current = null

        const graph = graphRef.current
        const sigma = sigmaRef.current
        if (graph && sigma) {
          // Snapshot → noverlap → animate
          const beforePositions = new Map<string, { x: number; y: number }>()
          graph.forEachNode((node, attrs) => {
            beforePositions.set(node, { x: attrs.x, y: attrs.y })
          })

          noverlap.assign(graph, NOVERLAP_SETTINGS)
          const afterPositions = new Map<string, { x: number; y: number }>()
          graph.forEachNode((node, attrs) => {
            afterPositions.set(node, { x: attrs.x, y: attrs.y })
          })

          graph.forEachNode((node) => {
            const pos = beforePositions.get(node)
            if (pos) {
              graph.setNodeAttribute(node, 'x', pos.x)
              graph.setNodeAttribute(node, 'y', pos.y)
            }
          })

          animatePositions(graph, afterPositions, sigma, 600)
        }
      }
    } finally {
      setIsLayoutRunning(false)
    }
  }, [])

  return {
    containerRef,
    sigmaRef,
    setGraph,
    zoomIn,
    zoomOut,
    resetZoom,
    focusNode,
    isLayoutRunning,
    startLayout,
    stopLayout,
    selectedNode,
    setSelectedNode,
    edgesHidden,
    setEdgesHidden,
  }
}
