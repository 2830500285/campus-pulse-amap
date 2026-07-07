import type {
  GraphEdge,
  GraphNode,
  MapPoint,
  PlaceRecord,
  PlannedRoute,
  RouteStep,
} from '../../../shared/navigation.js'

interface AdjacencyEdge {
  edge: GraphEdge
  nextNodeId: string
  instruction: string
}

interface PathState {
  distance: number
  previousNodeId: string | null
  previousEdge: GraphEdge | null
  previousInstruction: string | null
}

export class RoutePlanner {
  private readonly nodeMap: Map<string, GraphNode>
  private readonly adjacency: Map<string, AdjacencyEdge[]>

  constructor(
    private readonly nodes: GraphNode[],
    private readonly edges: GraphEdge[],
    private readonly places: PlaceRecord[],
  ) {
    this.nodeMap = new Map(nodes.map((node) => [node.id, node]))
    this.adjacency = this.buildAdjacency(edges)
  }

  planRoute(startPlaceId: string, endPlaceId: string): PlannedRoute {
    const startPlace = this.requirePlace(startPlaceId)
    const endPlace = this.requirePlace(endPlaceId)

    if (startPlace.id === endPlace.id) {
      return {
        startPlaceId,
        endPlaceId,
        distanceMeters: 0,
        estimatedMinutes: 0,
        pathPoints: [startPlace.mapPoint],
        steps: [
          {
            edgeId: 'same-place',
            fromLabel: startPlace.name,
            toLabel: endPlace.name,
            instruction: `起点和终点都是 ${startPlace.name}，无需再规划路线。`,
            distanceMeters: 0,
          },
        ],
      }
    }

    let bestRoute: PlannedRoute | null = null

    for (const startNodeId of startPlace.accessNodeIds) {
      for (const endNodeId of endPlace.accessNodeIds) {
        const candidate = this.planBetweenNodes(startPlace.id, endPlace.id, startNodeId, endNodeId)

        if (!candidate) {
          continue
        }

        if (!bestRoute || candidate.distanceMeters < bestRoute.distanceMeters) {
          bestRoute = candidate
        }
      }
    }

    if (!bestRoute) {
      throw new Error(`当前无法从 ${startPlace.name} 到达 ${endPlace.name}。`)
    }

    return bestRoute
  }

  private buildAdjacency(edges: GraphEdge[]) {
    const adjacency = new Map<string, AdjacencyEdge[]>()

    function pushEdge(nodeId: string, nextEdge: AdjacencyEdge) {
      const existing = adjacency.get(nodeId) ?? []
      existing.push(nextEdge)
      adjacency.set(nodeId, existing)
    }

    for (const edge of edges) {
      if (edge.closed) {
        continue
      }

      pushEdge(edge.fromNodeId, {
        edge,
        nextNodeId: edge.toNodeId,
        instruction: edge.forwardText,
      })
      pushEdge(edge.toNodeId, {
        edge,
        nextNodeId: edge.fromNodeId,
        instruction: edge.backwardText,
      })
    }

    return adjacency
  }

  private planBetweenNodes(
    startPlaceId: string,
    endPlaceId: string,
    startNodeId: string,
    endNodeId: string,
  ) {
    const queue = new Set<string>(this.nodes.map((node) => node.id))
    const stateMap = new Map<string, PathState>()

    for (const node of this.nodes) {
      stateMap.set(node.id, {
        distance: node.id === startNodeId ? 0 : Number.POSITIVE_INFINITY,
        previousNodeId: null,
        previousEdge: null,
        previousInstruction: null,
      })
    }

    while (queue.size > 0) {
      let currentNodeId: string | null = null
      let currentDistance = Number.POSITIVE_INFINITY

      for (const nodeId of queue) {
        const candidateDistance = stateMap.get(nodeId)?.distance ?? Number.POSITIVE_INFINITY

        if (candidateDistance < currentDistance) {
          currentDistance = candidateDistance
          currentNodeId = nodeId
        }
      }

      if (!currentNodeId || currentDistance === Number.POSITIVE_INFINITY) {
        break
      }

      if (currentNodeId === endNodeId) {
        break
      }

      queue.delete(currentNodeId)

      const outgoing = this.adjacency.get(currentNodeId) ?? []

      for (const nextHop of outgoing) {
        if (!queue.has(nextHop.nextNodeId)) {
          continue
        }

        const existing = stateMap.get(nextHop.nextNodeId)

        if (!existing) {
          continue
        }

        const nextDistance = currentDistance + nextHop.edge.distanceMeters

        if (nextDistance < existing.distance) {
          stateMap.set(nextHop.nextNodeId, {
            distance: nextDistance,
            previousNodeId: currentNodeId,
            previousEdge: nextHop.edge,
            previousInstruction: nextHop.instruction,
          })
        }
      }
    }

    const finalState = stateMap.get(endNodeId)

    if (!finalState || finalState.distance === Number.POSITIVE_INFINITY) {
      return null
    }

    const pathNodeIds = this.rebuildNodePath(stateMap, endNodeId)
    const steps = this.rebuildSteps(stateMap, pathNodeIds)

    return {
      startPlaceId,
      endPlaceId,
      distanceMeters: finalState.distance,
      estimatedMinutes: Math.max(1, Math.round(finalState.distance / 75)),
      pathPoints: pathNodeIds.map((nodeId) => this.getNodePoint(nodeId)),
      steps,
    }
  }

  private rebuildNodePath(stateMap: Map<string, PathState>, endNodeId: string) {
    const orderedNodeIds: string[] = []
    let currentNodeId: string | null = endNodeId

    while (currentNodeId) {
      orderedNodeIds.unshift(currentNodeId)
      currentNodeId = stateMap.get(currentNodeId)?.previousNodeId ?? null
    }

    return orderedNodeIds
  }

  private rebuildSteps(stateMap: Map<string, PathState>, pathNodeIds: string[]) {
    const steps: RouteStep[] = []

    for (let index = 1; index < pathNodeIds.length; index += 1) {
      const currentNodeId = pathNodeIds[index]
      const currentState = stateMap.get(currentNodeId)
      const currentNode = this.requireNode(currentNodeId)
      const previousNode = this.requireNode(pathNodeIds[index - 1])

      if (!currentState?.previousEdge || !currentState.previousInstruction) {
        continue
      }

      steps.push({
        edgeId: currentState.previousEdge.id,
        fromLabel: previousNode.label,
        toLabel: currentNode.label,
        instruction: currentState.previousInstruction,
        distanceMeters: currentState.previousEdge.distanceMeters,
      })
    }

    return steps
  }

  private getNodePoint(nodeId: string): MapPoint {
    const node = this.requireNode(nodeId)

    return { xPct: node.xPct, yPct: node.yPct }
  }

  private requirePlace(placeId: string) {
    const place = this.places.find((candidate) => candidate.id === placeId)

    if (!place) {
      throw new Error(`未找到地点 ${placeId}。`)
    }

    return place
  }

  private requireNode(nodeId: string) {
    const node = this.nodeMap.get(nodeId)

    if (!node) {
      throw new Error(`未找到路网节点 ${nodeId}。`)
    }

    return node
  }
}
