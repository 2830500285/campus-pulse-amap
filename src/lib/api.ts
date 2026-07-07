import type { PlannedRoute, RoutePlanRequest } from '../types/navigation'
import { graphEdges, graphNodes } from '../data/graph'
import { places } from '../data/places'
import { LocalRoutePlanner } from './local-route-planner'

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? '/api'
const localRoutePlanner = new LocalRoutePlanner(graphNodes, graphEdges, places)

function shouldPreferLocalPlanner() {
  if (typeof window === 'undefined') {
    return false
  }

  return /\.github\.io$/i.test(window.location.hostname)
}

function planRouteLocally(payload: RoutePlanRequest) {
  return localRoutePlanner.planRoute(payload.startPlaceId, payload.endPlaceId)
}

export async function requestRoutePlan(payload: RoutePlanRequest) {
  if (shouldPreferLocalPlanner()) {
    return planRouteLocally(payload)
  }

  const response = await fetch(`${apiBaseUrl}/navigation/route`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  }).catch(() => null)

  if (!response) {
    return planRouteLocally(payload)
  }

  if (response.ok) {
    return (await response.json()) as PlannedRoute
  }

  const errorPayload = (await response.json().catch(() => null)) as
    | { message?: string }
    | null

  if (response.status === 404 || response.status >= 500) {
    return planRouteLocally(payload)
  }

  throw new Error(errorPayload?.message ?? '路线规划失败。')
}
