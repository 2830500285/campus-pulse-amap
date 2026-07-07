import { placeCategories } from '../data/categories'
import type {
  FilterState,
  MapMarker,
  MapPoint,
  PlaceCategory,
  PlaceRecord,
} from '../types/navigation'

export const defaultFilters: FilterState = {
  q: '',
  category: 'all',
  zone: 'all',
  selected: '',
  start: '',
  end: '',
}

function normalizeText(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, '')
}

export function parseFilters(searchParams: URLSearchParams): FilterState {
  return {
    q: searchParams.get('q') ?? defaultFilters.q,
    category: searchParams.get('category') ?? defaultFilters.category,
    zone: searchParams.get('zone') ?? defaultFilters.zone,
    selected: searchParams.get('selected') ?? defaultFilters.selected,
    start: searchParams.get('start') ?? defaultFilters.start,
    end: searchParams.get('end') ?? defaultFilters.end,
  }
}

export function buildSearchParams(filters: FilterState) {
  const searchParams = new URLSearchParams()

  if (filters.q.trim()) {
    searchParams.set('q', filters.q.trim())
  }

  if (filters.category !== defaultFilters.category) {
    searchParams.set('category', filters.category)
  }

  if (filters.zone !== defaultFilters.zone) {
    searchParams.set('zone', filters.zone)
  }

  if (filters.selected) {
    searchParams.set('selected', filters.selected)
  }

  if (filters.start) {
    searchParams.set('start', filters.start)
  }

  if (filters.end) {
    searchParams.set('end', filters.end)
  }

  return searchParams
}

export function filterPlaces(places: PlaceRecord[], filters: FilterState) {
  const normalizedQuery = normalizeText(filters.q)

  return places.filter((place) => {
    if (filters.category !== 'all' && place.categoryId !== filters.category) {
      return false
    }

    if (filters.zone !== 'all' && place.zone !== filters.zone) {
      return false
    }

    if (!normalizedQuery) {
      return true
    }

    const searchHaystack = [
      place.name,
      place.zone,
      ...place.aliases,
      ...place.keywords,
    ]
      .map(normalizeText)
      .join('|')

    return searchHaystack.includes(normalizedQuery)
  })
}

export function getCategoryMap(categories: PlaceCategory[]) {
  return Object.fromEntries(categories.map((category) => [category.id, category]))
}

export function buildMapMarkers(places: PlaceRecord[]): MapMarker[] {
  const categoryMap = getCategoryMap(placeCategories)

  return places.map((place) => {
    const category = categoryMap[place.categoryId]

    return {
      id: place.id,
      name: place.name,
      categoryId: place.categoryId,
      icon: category.icon,
      accent: category.accent,
      zone: place.zone,
      xPct: place.mapPoint.xPct,
      yPct: place.mapPoint.yPct,
    }
  })
}

export function getMarkerPositionStyle(point: MapPoint) {
  return {
    left: `${point.xPct}%`,
    top: `${point.yPct}%`,
  }
}

export function getPlaceById(places: PlaceRecord[], placeId: string | undefined) {
  return places.find((place) => place.id === placeId) ?? null
}

export function getAvailableZones(places: PlaceRecord[]) {
  return Array.from(new Set(places.map((place) => place.zone)))
}

export function getCategoryLabel(categoryId: string) {
  return placeCategories.find((category) => category.id === categoryId)?.label ?? '未分类'
}

export function getCategoryIcon(categoryId: string) {
  return placeCategories.find((category) => category.id === categoryId)?.icon ?? '点'
}

export function getCategoryAccent(categoryId: string) {
  return placeCategories.find((category) => category.id === categoryId)?.accent ?? '#1d2939'
}

export function getRelatedPlaces(places: PlaceRecord[], currentPlace: PlaceRecord) {
  return places
    .filter((place) => place.id !== currentPlace.id)
    .filter(
      (place) =>
        place.zone === currentPlace.zone || place.categoryId === currentPlace.categoryId,
    )
    .slice(0, 3)
}

export function getPlaceName(places: PlaceRecord[], placeId: string) {
  return places.find((place) => place.id === placeId)?.name ?? '未选择地点'
}
