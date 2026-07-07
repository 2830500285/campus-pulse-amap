import { useEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'

import { AmapLiveMap } from './AmapLiveMap'
import { getMarkerPositionStyle } from '../lib/navigation'
import type {
  CampusConfig,
  LivePoiSelection,
  MapMarker,
  PlaceRecord,
  PlannedRoute,
} from '../types/navigation'

interface CampusMapProps {
  activeMarkerId: string
  campus: CampusConfig
  endPlaceId: string
  livePoi: LivePoiSelection | null
  markers: MapMarker[]
  places: PlaceRecord[]
  onMarkerEnter: (markerId: string) => void
  onMarkerLeave: () => void
  onMarkerSelect: (markerId: string) => void
  route: PlannedRoute | null
  selectedPlaceId: string
  startPlaceId: string
}

export function CampusMap({
  activeMarkerId,
  campus,
  endPlaceId,
  livePoi,
  markers,
  places,
  onMarkerEnter,
  onMarkerLeave,
  onMarkerSelect,
  route,
  selectedPlaceId,
  startPlaceId,
}: CampusMapProps) {
  const shouldPreferCampusInTests = import.meta.env.MODE === 'test'
  const [manualMode, setManualMode] = useState<'campus' | 'amap'>(
    shouldPreferCampusInTests ? 'campus' : 'amap',
  )
  const previousSelectionRef = useRef({
    livePoiId: '',
    startPlaceId: '',
    endPlaceId: '',
  })

  useEffect(() => {
    const nextLivePoiId = livePoi?.id ?? ''
    const previousSelection = previousSelectionRef.current
    const hasSelectionChanged =
      previousSelection.livePoiId !== nextLivePoiId ||
      previousSelection.startPlaceId !== startPlaceId ||
      previousSelection.endPlaceId !== endPlaceId
    const hasActiveNavigationContext = Boolean(nextLivePoiId || startPlaceId || endPlaceId)

    if (hasSelectionChanged && hasActiveNavigationContext) {
      setManualMode(shouldPreferCampusInTests ? 'campus' : 'amap')
    }

    previousSelectionRef.current = {
      livePoiId: nextLivePoiId,
      startPlaceId,
      endPlaceId,
    }
  }, [endPlaceId, livePoi?.id, shouldPreferCampusInTests, startPlaceId])

  const mode = manualMode

  return (
    <section className="map-card" aria-labelledby="map-title">
      <div className="map-card__header">
        <div>
          <p className="control-card__eyebrow">高德空间雷达</p>
          <h2 id="map-title">高德实景地图与拓扑校验</h2>
        </div>
        <div className="map-card__toolbar">
          <div className="map-card__tabs" role="tablist" aria-label="地图模式">
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'amap'}
              className={mode === 'amap' ? 'map-card__tab map-card__tab--active' : 'map-card__tab'}
              onClick={() => setManualMode('amap')}
            >
              实景地图
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'campus'}
              className={mode === 'campus' ? 'map-card__tab map-card__tab--active' : 'map-card__tab'}
              onClick={() => setManualMode('campus')}
            >
              校园拓扑
            </button>
          </div>
          <p className="map-card__legend">
            {mode === 'campus'
              ? '备用视图，用于核对本地路网结构、入口节点和路线折线'
              : '由高德 JSAPI 2.0 提供真实底图、实时地点、定位和步行规划'}
          </p>
        </div>
      </div>
      {mode === 'campus' ? (
        <div className="map-card__canvas">
          <img src={campus.mapAsset} alt={campus.mapAlt} />
          <div className="map-card__grid" aria-hidden="true" />
          {route ? (
            <svg className="map-card__route-layer" viewBox="0 0 100 100" preserveAspectRatio="none">
              <polyline
                className="map-card__route-line"
                points={route.pathPoints.map((point) => `${point.xPct},${point.yPct}`).join(' ')}
              />
            </svg>
          ) : null}
          {markers.map((marker) => {
            const isActive = activeMarkerId === marker.id
            const isStart = startPlaceId === marker.id
            const isEnd = endPlaceId === marker.id
            const routeClassName = isStart
              ? 'map-marker map-marker--route-start'
              : isEnd
                ? 'map-marker map-marker--route-end'
                : 'map-marker'

            return (
              <button
                key={marker.id}
                type="button"
                className={isActive ? `${routeClassName} map-marker--active` : routeClassName}
                style={
                  {
                    ...getMarkerPositionStyle({ xPct: marker.xPct, yPct: marker.yPct }),
                    '--marker-accent': marker.accent,
                  } as CSSProperties
                }
                aria-label={`${marker.name} 点位`}
                aria-pressed={isActive}
                onMouseEnter={() => onMarkerEnter(marker.id)}
                onMouseLeave={onMarkerLeave}
                onFocus={() => onMarkerEnter(marker.id)}
                onBlur={onMarkerLeave}
                onClick={() => onMarkerSelect(marker.id)}
              >
                <span className="map-marker__pulse" aria-hidden="true" />
                <span className="map-marker__glyph">{marker.icon}</span>
                <span className="map-marker__label">{marker.name}</span>
                {isStart ? <span className="map-marker__endpoint">起</span> : null}
                {isEnd ? <span className="map-marker__endpoint map-marker__endpoint--end">终</span> : null}
              </button>
            )
          })}
        </div>
      ) : (
        <AmapLiveMap
          campus={campus}
          endPlaceId={endPlaceId}
          livePoi={livePoi}
          places={places}
          selectedPlaceId={selectedPlaceId}
          startPlaceId={startPlaceId}
        />
      )}
    </section>
  )
}
