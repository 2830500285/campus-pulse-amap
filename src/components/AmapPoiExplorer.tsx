import { useEffect, useMemo, useRef, useState } from 'react'

import type { CampusConfig, LivePoiSelection } from '../types/navigation'

type LngLatTuple = [number, number]

interface AmapPoiRecord {
  id?: string
  name?: string
  type?: string
  address?: string
  distance?: number
  location?: unknown
}

interface AmapPoiResult {
  poiList?: {
    pois?: AmapPoiRecord[]
  }
}

interface AmapPlaceSearchInstance {
  search: (
    keyword: string,
    callback: (status: string, result: AmapPoiResult) => void,
  ) => void
  searchNearBy: (
    keyword: string,
    center: LngLatTuple,
    radius: number,
    callback: (status: string, result: AmapPoiResult) => void,
  ) => void
}

interface AmapNamespace {
  PlaceSearch: new (options?: Record<string, unknown>) => AmapPlaceSearchInstance
}

const FALLBACK_CENTER: LngLatTuple = [120.12043, 36.001796]
const CAMPUS_OFFICIAL_NAME = '山东科技大学青岛校区'
const BLANK_QUERY_RADIUS = 650
const FILTERED_QUERY_RADIUS = 1200
const MAX_RESULTS = 12

const campusKeywords = [
  '山科',
  '山科大',
  '学院',
  '楼',
  '馆',
  '餐厅',
  '食堂',
  '公寓',
  '体育',
  '医院',
  '实验',
  '中心',
  '广场',
  '超市',
  '购物广场',
  '营业厅',
]

function toLngLatTuple(value: unknown): LngLatTuple | null {
  if (
    Array.isArray(value) &&
    value.length >= 2 &&
    typeof value[0] === 'number' &&
    typeof value[1] === 'number'
  ) {
    return [value[0], value[1]]
  }

  if (
    value &&
    typeof value === 'object' &&
    'lng' in value &&
    'lat' in value &&
    typeof value.lng === 'number' &&
    typeof value.lat === 'number'
  ) {
    return [value.lng, value.lat]
  }

  return null
}

function isCampusPoi(poi: AmapPoiRecord, query: string) {
  const name = poi.name?.trim() ?? ''
  const address = poi.address?.trim() ?? ''

  if (!name || /停车场|公交站/.test(name)) {
    return false
  }

  if (query.trim()) {
    return true
  }

  if ((poi.distance ?? Number.POSITIVE_INFINITY) > BLANK_QUERY_RADIUS) {
    return false
  }

  return campusKeywords.some((keyword) => name.includes(keyword) || address.includes(keyword))
}

function normalizePois(pois: AmapPoiRecord[], query: string): LivePoiSelection[] {
  const seenNames = new Set<string>()

  return pois
    .filter((poi) => isCampusPoi(poi, query))
    .map((poi) => {
      const position = toLngLatTuple(poi.location)

      if (!position || !poi.name) {
        return null
      }

      return {
        id: poi.id ?? `${poi.name}-${position[0]}-${position[1]}`,
        name: poi.name,
        address: poi.address ?? '青岛校区周边',
        type: poi.type ?? '高德实时地点',
        distanceMeters: poi.distance ?? 0,
        lng: position[0],
        lat: position[1],
      }
    })
    .filter((poi): poi is LivePoiSelection => poi !== null)
    .filter((poi) => {
      if (seenNames.has(poi.name)) {
        return false
      }

      seenNames.add(poi.name)
      return true
    })
    .slice(0, MAX_RESULTS)
}

interface AmapPoiExplorerProps {
  campus: CampusConfig
  query: string
  selectedPoiId: string
  onLocate: (poi: LivePoiSelection) => void
}

export function AmapPoiExplorer({
  campus,
  query,
  selectedPoiId,
  onLocate,
}: AmapPoiExplorerProps) {
  const [pois, setPois] = useState<LivePoiSelection[]>([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const centerRef = useRef<LngLatTuple>(FALLBACK_CENTER)
  const searchRef = useRef<AmapPlaceSearchInstance | null>(null)

  const helperText = useMemo(() => {
    if (query.trim()) {
      return `正在用高德检索“${query.trim()}”相关的校内地点，用来补齐本地路网之外的楼宇与服务点。`
    }

    return '这里展示高德实时收录的校内 POI，用来补齐本地路网之外仍未录入的楼宇、学院、餐厅和服务设施。'
  }, [query])

  useEffect(() => {
    let cancelled = false

    async function ensureSearch() {
      if (searchRef.current) {
        return searchRef.current
      }

      const amapKey = import.meta.env.VITE_AMAP_JSAPI_KEY
      const securityJsCode = import.meta.env.VITE_AMAP_SECURITY_JS_CODE

      if (!amapKey || !securityJsCode) {
        setError('未检测到高德前端凭据，无法补齐实时地点。')
        return null
      }

      try {
        const { default: AMapLoader } = await import('@amap/amap-jsapi-loader')

        window._AMapSecurityConfig = {
          securityJsCode,
        }

        const AMap = (await AMapLoader.load({
          key: amapKey,
          version: '2.0',
          plugins: ['AMap.PlaceSearch'],
        })) as AmapNamespace

        if (cancelled) {
          return null
        }

        const nextSearch = new AMap.PlaceSearch({
          city: '青岛市',
          pageSize: 30,
          pageIndex: 1,
          citylimit: false,
          autoFitView: false,
        })

        searchRef.current = nextSearch

        await new Promise<void>((resolve) => {
          nextSearch.search(CAMPUS_OFFICIAL_NAME, (status: string, result: AmapPoiResult) => {
            if (status === 'complete' && result?.poiList?.pois?.length) {
              const position = toLngLatTuple(result.poiList.pois[0].location)
              if (position) {
                centerRef.current = position
              }
            }

            resolve()
          })
        })

        return nextSearch
      } catch (nextError) {
        if (!cancelled) {
          setError(nextError instanceof Error ? nextError.message : '高德实时地点加载失败。')
        }

        return null
      }
    }

    async function searchNearbyPoi() {
      setLoading(true)
      setError('')

      const placeSearch = await ensureSearch()

      if (!placeSearch || cancelled) {
        setLoading(false)
        return
      }

      const radius = query.trim() ? FILTERED_QUERY_RADIUS : BLANK_QUERY_RADIUS
      const nextPois = await new Promise<LivePoiSelection[]>((resolve) => {
        placeSearch.searchNearBy(
          query.trim(),
          centerRef.current,
          radius,
          (status: string, result: AmapPoiResult) => {
            if (status !== 'complete' || !result?.poiList?.pois?.length) {
              resolve([])
              return
            }

            resolve(normalizePois(result.poiList.pois, query))
          },
        )
      })

      if (!cancelled) {
        setPois(nextPois)
        if (!nextPois.length) {
          setError('高德当前没有返回更合适的校内地点，可以换一个关键词继续搜。')
        }
        setLoading(false)
      }
    }

    void searchNearbyPoi()

    return () => {
      cancelled = true
    }
  }, [campus, query])

  return (
    <section className="support-card live-poi-card" aria-labelledby="live-poi-title">
      <div className="control-card__header">
        <div>
          <p className="control-card__eyebrow">高德实时地点</p>
          <h2 id="live-poi-title">补齐本地路网之外的校园地点</h2>
        </div>
        <p className="list-card__hint">{loading ? '正在同步高德 POI…' : `${pois.length} 个实时地点`}</p>
      </div>
      <p className="live-poi-card__note">{helperText}</p>
      {error ? <p className="route-planner-error">{error}</p> : null}
      <ul className="live-poi-list">
        {pois.map((poi) => (
          <li key={poi.id}>
            <button
              type="button"
              className={
                selectedPoiId === poi.id
                  ? 'live-poi-item live-poi-item--active'
                  : 'live-poi-item'
              }
              onClick={() => onLocate(poi)}
            >
              <span className="live-poi-item__name">{poi.name}</span>
              <span className="live-poi-item__meta">
                <span>{poi.distanceMeters} 米</span>
                <span>{poi.type.split(';').at(-1) ?? poi.type}</span>
              </span>
              <small>{poi.address}</small>
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}
