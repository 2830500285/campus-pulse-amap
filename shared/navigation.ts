export type PlaceCategoryId =
  | 'teaching'
  | 'lab'
  | 'dormitory'
  | 'dining'
  | 'library'
  | 'sports'
  | 'admin'
  | 'gate'
  | 'medical'
  | 'landmark'

export interface CampusConfig {
  id: string
  name: string
  city: string
  description: string
  mapAsset: string
  mapAlt: string
  mapNote: string
  defaultView: {
    centerLabel: string
    highlightedZones: string[]
  }
}

export interface PlaceCategory {
  id: PlaceCategoryId
  label: string
  icon: string
  order: number
  accent: string
}

export interface MapPoint {
  xPct: number
  yPct: number
}

export interface PlaceRecord {
  id: string
  name: string
  categoryId: PlaceCategoryId
  zone: string
  description: string
  aliases: string[]
  keywords: string[]
  mapPoint: MapPoint
  accessNodeIds: string[]
  arrivalTips: string
  note?: string
}

export interface MapMarker {
  id: string
  name: string
  categoryId: PlaceCategoryId
  icon: string
  accent: string
  zone: string
  xPct: number
  yPct: number
}

export interface FilterState {
  q: string
  category: string
  zone: string
  selected: string
  start: string
  end: string
}

export interface GraphNode {
  id: string
  label: string
  zone: string
  xPct: number
  yPct: number
}

export interface GraphEdge {
  id: string
  fromNodeId: string
  toNodeId: string
  distanceMeters: number
  pathName: string
  forwardText: string
  backwardText: string
  closed?: boolean
}

export interface RouteStep {
  edgeId: string
  fromLabel: string
  toLabel: string
  instruction: string
  distanceMeters: number
}

export interface PlannedRoute {
  startPlaceId: string
  endPlaceId: string
  distanceMeters: number
  estimatedMinutes: number
  pathPoints: MapPoint[]
  steps: RouteStep[]
}

export interface LivePoiSelection {
  id: string
  name: string
  address: string
  type: string
  distanceMeters: number
  lng: number
  lat: number
}

export interface NavigationBootstrap {
  campus: CampusConfig
  categories: PlaceCategory[]
  places: PlaceRecord[]
}

export interface RoutePlanRequest {
  startPlaceId: string
  endPlaceId: string
}
