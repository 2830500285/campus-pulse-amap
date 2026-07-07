import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'

import { AmapPoiExplorer } from '../components/AmapPoiExplorer'
import { CampusMap } from '../components/CampusMap'
import { CampusOverview } from '../components/CampusOverview'
import { CategoryFilter } from '../components/CategoryFilter'
import { EmptyState } from '../components/EmptyState'
import { PlaceList } from '../components/PlaceList'
import { PlacePreview } from '../components/PlacePreview'
import { RoutePlanner } from '../components/RoutePlanner'
import { RouteSummary } from '../components/RouteSummary'
import { SearchBar } from '../components/SearchBar'
import { campusConfig, campusZones } from '../data/campus'
import { placeCategories } from '../data/categories'
import { places } from '../data/places'
import { requestRoutePlan } from '../lib/api'
import {
  buildMapMarkers,
  buildSearchParams,
  defaultFilters,
  filterPlaces,
  getAvailableZones,
  getPlaceById,
  parseFilters,
} from '../lib/navigation'
import type { FilterState, LivePoiSelection, PlannedRoute } from '../types/navigation'

function updateFilterState(
  currentSearchParams: URLSearchParams,
  nextPatch: Partial<FilterState>,
) {
  const currentFilters = parseFilters(currentSearchParams)
  const nextFilters: FilterState = { ...currentFilters, ...nextPatch }

  if (
    nextPatch.q !== undefined ||
    nextPatch.category !== undefined ||
    nextPatch.zone !== undefined
  ) {
    nextFilters.selected = nextPatch.selected ?? ''
  }

  return buildSearchParams(nextFilters)
}

export function HomePage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [hoveredId, setHoveredId] = useState('')
  const [livePoi, setLivePoi] = useState<LivePoiSelection | null>(null)
  const [isPlanning, setIsPlanning] = useState(false)
  const [routeError, setRouteError] = useState('')
  const [plannedRoute, setPlannedRoute] = useState<PlannedRoute | null>(null)
  const filters = parseFilters(searchParams)
  const visiblePlaces = filterPlaces(places, filters)
  const displayedPlaceIds = new Set(
    [
      ...visiblePlaces.map((place) => place.id),
      filters.selected,
      filters.start,
      filters.end,
    ].filter(Boolean),
  )
  const displayedPlaces = places.filter((place) => displayedPlaceIds.has(place.id))
  const markers = buildMapMarkers(displayedPlaces)
  const selectedPlace = getPlaceById(places, filters.selected)
  const activePlaceId = hoveredId || selectedPlace?.id || ''
  const knownZones = getAvailableZones(places)

  function applyPatch(nextPatch: Partial<FilterState>) {
    setLivePoi(null)
    setSearchParams(updateFilterState(searchParams, nextPatch), { replace: true })
  }

  function resetFilters() {
    setLivePoi(null)
    setSearchParams(buildSearchParams(defaultFilters), { replace: true })
    setPlannedRoute(null)
    setRouteError('')
  }

  function clearRoute() {
    setLivePoi(null)
    applyPatch({
      start: '',
      end: '',
    })
  }

  function swapRoute() {
    applyPatch({
      start: filters.end,
      end: filters.start,
    })
  }

  useEffect(() => {
    let cancelled = false

    async function runRoutePlan() {
      if (!filters.start || !filters.end) {
        setPlannedRoute(null)
        setRouteError('')
        setIsPlanning(false)
        return
      }

      setIsPlanning(true)
      setRouteError('')

      try {
        const nextRoute = await requestRoutePlan({
          startPlaceId: filters.start,
          endPlaceId: filters.end,
        })

        if (!cancelled) {
          setPlannedRoute(nextRoute)
        }
      } catch (error) {
        if (!cancelled) {
          setPlannedRoute(null)
          setRouteError(error instanceof Error ? error.message : '路线规划失败。')
        }
      } finally {
        if (!cancelled) {
          setIsPlanning(false)
        }
      }
    }

    void runRoutePlan()

    return () => {
      cancelled = true
    }
  }, [filters.end, filters.start])

  return (
    <div className="page-shell">
      <header className="hero-banner">
        <div className="hero-banner__content">
          <p className="hero-banner__eyebrow">AMap JSAPI / Campus Mobility</p>
          <h1>山科智行 Campus Pulse</h1>
          <p className="hero-banner__summary">
            使用高德地图开放平台 JSAPI 呈现实景底图、POI 检索、定位和步行路线，再叠加校内地点数据，形成一张白色、清晰、可演示的校园出行工作台。
          </p>
        </div>
        <div className="hero-banner__stats">
          <div>
            <strong>服务点位</strong>
            <span>{places.length} 个</span>
          </div>
          <div>
            <strong>行动场景</strong>
            <span>{placeCategories.length} 类</span>
          </div>
          <div>
            <strong>地图引擎</strong>
            <span>高德 JSAPI</span>
          </div>
        </div>
      </header>

      <main className="workspace-grid">
        <section className="navigation-stage" aria-label="首屏导航区">
          <div className="navigation-stage__panel">
            <RoutePlanner
              endPlaceId={filters.end}
              error={routeError}
              isPlanning={isPlanning}
              places={places}
              startPlaceId={filters.start}
              onClear={clearRoute}
              onEndChange={(placeId) => applyPatch({ end: placeId })}
              onStartChange={(placeId) => applyPatch({ start: placeId })}
              onSwap={swapRoute}
            />
            <RouteSummary places={places} route={plannedRoute} />
            <PlacePreview
              endPlaceId={filters.end}
              filters={filters}
              startPlaceId={filters.start}
              onClose={() => applyPatch({ selected: '' })}
              onEndSelect={(placeId) => applyPatch({ end: placeId })}
              onStartSelect={(placeId) => applyPatch({ start: placeId })}
              place={selectedPlace}
            />
          </div>

          <div className="navigation-stage__map">
            <CampusMap
              activeMarkerId={activePlaceId}
              campus={campusConfig}
              endPlaceId={filters.end}
              livePoi={livePoi}
              markers={markers}
              places={places}
              route={plannedRoute}
              selectedPlaceId={filters.selected}
              startPlaceId={filters.start}
              onMarkerEnter={setHoveredId}
              onMarkerLeave={() => setHoveredId('')}
              onMarkerSelect={(markerId) => applyPatch({ selected: markerId })}
            />
          </div>
        </section>

        <div className="workspace-grid__lower">
          <div className="workspace-grid__main">
            <SearchBar
              count={visiblePlaces.length}
              total={places.length}
              value={filters.q}
              onChange={(nextValue) => applyPatch({ q: nextValue })}
            />
            <AmapPoiExplorer
              campus={campusConfig}
              query={filters.q}
              selectedPoiId={livePoi?.id ?? ''}
              onLocate={setLivePoi}
            />
            <CategoryFilter
              activeCategory={filters.category}
              categories={placeCategories}
              onChange={(categoryId) => applyPatch({ category: categoryId })}
            />
            <CampusOverview
              activeZone={filters.zone}
              campus={campusConfig}
              zones={campusZones}
              onZoneChange={(zoneName) => applyPatch({ zone: zoneName })}
            />
            {visiblePlaces.length ? (
              <PlaceList
                activePlaceId={activePlaceId}
                endPlaceId={filters.end}
                places={visiblePlaces}
                selectedPlaceId={filters.selected}
                startPlaceId={filters.start}
                onPlaceEnter={setHoveredId}
                onPlaceLeave={() => setHoveredId('')}
                onPlaceSelect={(placeId) => applyPatch({ selected: placeId })}
              />
            ) : (
              <EmptyState onReset={resetFilters} />
            )}
          </div>

          <aside className="workspace-grid__aside">
            <section className="support-card" aria-labelledby="support-title">
              <p className="control-card__eyebrow">运行边界</p>
              <h2 id="support-title">当前行动看板覆盖范围</h2>
              <ul>
                <li>当前内置 {places.length} 个可规划点位，覆盖学习、实验、生活和访客入口。</li>
                <li>高德 JSAPI 提供真实底图、POI 检索、定位控件和步行路线反馈。</li>
                <li>校内路网继续承担课程演示中的可解释路线计算，不是固定图片或静态说明。</li>
                <li>拓扑视图作为备用校验层，用于核对路径结构和入口节点。</li>
                <li>筛选、起终点和地点预览会同步写入链接，便于复现演示场景。</li>
                <li>继续补充封路规则、楼宇入口和后台维护后，可升级为正式校园服务平台。</li>
              </ul>
            </section>
            <section className="support-card" aria-labelledby="zone-title">
              <p className="control-card__eyebrow">场景带</p>
              <h2 id="zone-title">按使用目的组织空间</h2>
              <ul>
                <li>已覆盖 {knownZones.length} 个场景带的主干路线。</li>
                <li>搜索支持本地点位关键词，也会通过高德 POI 补齐实时地点。</li>
                <li>替换正式校区数据时只需校准点位与节点坐标，不影响高德地图接入方式。</li>
              </ul>
            </section>
          </aside>
        </div>
      </main>
    </div>
  )
}
