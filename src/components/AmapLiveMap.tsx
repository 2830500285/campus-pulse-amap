import { useEffect, useMemo, useRef, useState } from 'react'

import type { CampusConfig, LivePoiSelection, PlaceRecord } from '../types/navigation'

declare global {
  interface Window {
    _AMapSecurityConfig?: {
      securityJsCode?: string
      serviceHost?: string
    }
  }

  interface DeviceOrientationEvent {
    webkitCompassHeading?: number
  }

  interface Window {
    CampusPulseNativeTTS?: {
      speak: (text: string) => void
      stop?: () => void
      isAvailable?: () => boolean
      getStatus?: () => string
    }
  }
}

type DeviceOrientationPermissionState = 'granted' | 'denied' | 'prompt'

type DeviceOrientationEventConstructorWithPermission = typeof DeviceOrientationEvent & {
  requestPermission?: () => Promise<DeviceOrientationPermissionState>
}

type LngLatTuple = [number, number]

interface AmapPoiRecord {
  location?: unknown
}

interface AmapPoiResult {
  poiList?: {
    pois?: AmapPoiRecord[]
  }
}

interface AmapWalkingStep {
  instruction?: string
  distance?: number
  time?: number
  path?: unknown[]
  road?: string
  action?: string
  assist_action?: string
}

interface AmapWalkingRoute {
  distance?: number
  time?: number
  steps?: AmapWalkingStep[]
}

interface AmapWalkingResult {
  routes?: AmapWalkingRoute[]
}

interface AmapConvertResult {
  locations?: unknown[]
  info?: string
}

interface AmapMarkerInstance {
  setMap: (map: AmapMapInstance | null) => void
  setPosition?: (position: LngLatTuple) => void
}

interface AmapPlaceSearchInstance {
  search: (
    keyword: string,
    callback: (status: string, result: AmapPoiResult) => void,
  ) => void
}

interface AmapWalkingInstance {
  search: (
    start: LngLatTuple,
    end: LngLatTuple,
    callback: (status: string, result: AmapWalkingResult | string) => void,
  ) => void
  clear?: () => void
}

interface AmapMapInstance {
  addControl: (control: unknown) => void
  setCenter: (center: LngLatTuple) => void
  setZoom: (zoom: number) => void
  destroy?: () => void
}

interface AmapNamespace {
  Map: new (
    container: HTMLDivElement,
    options: Record<string, unknown>,
  ) => AmapMapInstance
  Scale: new () => unknown
  ToolBar: new (options?: Record<string, unknown>) => unknown
  MapType: new (options?: Record<string, unknown>) => unknown
  Geolocation: new (options?: Record<string, unknown>) => unknown
  PlaceSearch: new (options?: Record<string, unknown>) => AmapPlaceSearchInstance
  Walking: new (options?: Record<string, unknown>) => AmapWalkingInstance
  Marker: new (options?: Record<string, unknown>) => AmapMarkerInstance
  convertFrom?: (
    position: LngLatTuple,
    type: string,
    callback: (status: string, result: AmapConvertResult) => void,
  ) => void
}

interface RawBrowserLocation {
  coords: LngLatTuple
  accuracy: number
  heading: number | null
  speed: number | null
  timestamp: number
}

interface BrowserLocation extends RawBrowserLocation {
  rawCoords: LngLatTuple
  coordinateSystem: 'gcj02' | 'wgs84'
}

interface LiveNavigationStep {
  instruction: string
  distanceMeters: number
  timeSeconds: number
  path: LngLatTuple[]
}

interface LiveNavigationRoute {
  destinationPlaceId: string
  destinationName: string
  distanceMeters: number
  timeSeconds: number
  path: LngLatTuple[]
  steps: LiveNavigationStep[]
}

const DEFAULT_CENTER: LngLatTuple = [120.12043, 36.001796]
const DEFAULT_ZOOM = 16
const CAMPUS_MAX_DISTANCE_METERS = 3200
const STEP_ADVANCE_DISTANCE_METERS = 30
const ARRIVAL_DISTANCE_METERS = 25
const ROUTE_DEVIATION_DISTANCE_METERS = 75
const REROUTE_COOLDOWN_MS = 15_000
const GOOD_ACCURACY_METERS = 35
const USABLE_ACCURACY_METERS = 120

interface AmapLiveMapProps {
  campus: CampusConfig
  endPlaceId: string
  livePoi: LivePoiSelection | null
  places: PlaceRecord[]
  selectedPlaceId: string
  startPlaceId: string
}

function toLngLatTuple(value: unknown): LngLatTuple | null {
  if (
    Array.isArray(value) &&
    value.length >= 2 &&
    typeof value[0] === 'number' &&
    typeof value[1] === 'number'
  ) {
    return [value[0], value[1]]
  }

  if (typeof value === 'string') {
    const [lng, lat] = value.split(',').map((item) => Number(item.trim()))

    if (Number.isFinite(lng) && Number.isFinite(lat)) {
      return [lng, lat]
    }
  }

  if (value && typeof value === 'object') {
    const record = value as {
      lng?: unknown
      lat?: unknown
      getLng?: unknown
      getLat?: unknown
    }

    if (typeof record.lng === 'number' && typeof record.lat === 'number') {
      return [record.lng, record.lat]
    }

    if (typeof record.getLng === 'function' && typeof record.getLat === 'function') {
      const lng = record.getLng()
      const lat = record.getLat()

      if (typeof lng === 'number' && typeof lat === 'number') {
        return [lng, lat]
      }
    }
  }

  return null
}

function haversineDistance(from: LngLatTuple, to: LngLatTuple) {
  const earthRadius = 6_371_000
  const toRadians = (degrees: number) => (degrees * Math.PI) / 180
  const dLat = toRadians(to[1] - from[1])
  const dLng = toRadians(to[0] - from[0])
  const lat1 = toRadians(from[1])
  const lat2 = toRadians(to[1])

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2

  return 2 * earthRadius * Math.asin(Math.sqrt(a))
}

function distanceToSegmentMeters(point: LngLatTuple, start: LngLatTuple, end: LngLatTuple) {
  const metersPerDegreeLat = 110_540
  const metersPerDegreeLng = 111_320 * Math.cos((point[1] * Math.PI) / 180)
  const px = point[0] * metersPerDegreeLng
  const py = point[1] * metersPerDegreeLat
  const sx = start[0] * metersPerDegreeLng
  const sy = start[1] * metersPerDegreeLat
  const ex = end[0] * metersPerDegreeLng
  const ey = end[1] * metersPerDegreeLat
  const dx = ex - sx
  const dy = ey - sy
  const segmentLengthSquared = dx * dx + dy * dy

  if (segmentLengthSquared === 0) {
    return haversineDistance(point, start)
  }

  const projection = Math.max(0, Math.min(1, ((px - sx) * dx + (py - sy) * dy) / segmentLengthSquared))
  const nearestX = sx + projection * dx
  const nearestY = sy + projection * dy

  return Math.hypot(px - nearestX, py - nearestY)
}

function distanceToPathMeters(point: LngLatTuple, path: LngLatTuple[]) {
  if (!path.length) {
    return Number.POSITIVE_INFINITY
  }

  if (path.length === 1) {
    return haversineDistance(point, path[0])
  }

  let nearestDistance = Number.POSITIVE_INFINITY

  for (let index = 1; index < path.length; index += 1) {
    nearestDistance = Math.min(
      nearestDistance,
      distanceToSegmentMeters(point, path[index - 1], path[index]),
    )
  }

  return nearestDistance
}

function getCampusQueries(campus: CampusConfig) {
  return [
    campus.name,
    `${campus.name}${campus.city}`,
    `${campus.name} ${campus.city}`,
    `${campus.city}${campus.name}`,
  ]
}

function getPlaceQueries(campus: CampusConfig, place: PlaceRecord) {
  const candidates = [
    `${campus.name}${place.name}`,
    `${campus.name} ${place.name}`,
    `${place.name}${campus.name}`,
    `${campus.city}${place.name}`,
    place.name,
    ...place.aliases.map((alias) => `${campus.name}${alias}`),
    ...place.aliases,
  ]

  return Array.from(new Set(candidates.map((value) => value.trim()).filter(Boolean)))
}

function formatDistance(distanceMeters: number) {
  if (!Number.isFinite(distanceMeters)) {
    return '未知'
  }

  if (distanceMeters >= 1000) {
    return `${(distanceMeters / 1000).toFixed(1)} 公里`
  }

  return `${Math.max(0, Math.round(distanceMeters))} 米`
}

function formatDuration(timeSeconds: number) {
  if (!Number.isFinite(timeSeconds) || timeSeconds <= 0) {
    return '未知'
  }

  return `${Math.max(1, Math.round(timeSeconds / 60))} 分钟`
}

function getGeolocationErrorMessage(error: GeolocationPositionError) {
  if (error.code === error.PERMISSION_DENIED) {
    return '定位权限被拒绝，请在浏览器或手机系统设置中允许本网站使用定位。'
  }

  if (error.code === error.TIMEOUT) {
    return '定位超时，请移动到室外或网络更稳定的位置后重试。'
  }

  return '暂时无法获取当前位置，请确认 GPS、网络和定位权限可用。'
}

function normalizeHeading(degrees: number) {
  return ((degrees % 360) + 360) % 360
}

function getScreenOrientationAngle() {
  const orientation = window.screen?.orientation

  if (orientation && typeof orientation.angle === 'number') {
    return orientation.angle
  }

  const legacyOrientation = (window as { orientation?: unknown }).orientation

  return typeof legacyOrientation === 'number' ? legacyOrientation : 0
}

function getCompassHeading(event: DeviceOrientationEvent) {
  if (typeof event.webkitCompassHeading === 'number') {
    return normalizeHeading(event.webkitCompassHeading)
  }

  if (typeof event.alpha !== 'number') {
    return null
  }

  return normalizeHeading(360 - event.alpha + getScreenOrientationAngle())
}

function getPositionHeading(position: GeolocationPosition) {
  return typeof position.coords.heading === 'number' && Number.isFinite(position.coords.heading)
    ? normalizeHeading(position.coords.heading)
    : null
}

function getPositionSpeed(position: GeolocationPosition) {
  return typeof position.coords.speed === 'number' && Number.isFinite(position.coords.speed)
    ? position.coords.speed
    : null
}

function getAccuracyMessage(location: BrowserLocation) {
  if (location.coordinateSystem === 'wgs84') {
    return '当前位置已获取，但高德坐标转换失败，地图上可能仍有偏移。'
  }

  if (location.accuracy > USABLE_ACCURACY_METERS) {
    return `当前定位精度约 ${Math.round(location.accuracy)} 米，偏差较大；请到室外开阔区域后再开始导航。`
  }

  if (location.accuracy > GOOD_ACCURACY_METERS) {
    return `当前定位精度约 ${Math.round(location.accuracy)} 米，可用但不适合精确路口判断。`
  }

  return ''
}

function getStepEndPoint(step: LiveNavigationStep) {
  return step.path.at(-1) ?? null
}

function normalizeWalkingRoute(
  route: AmapWalkingRoute,
  destinationPlaceId: string,
  destinationName: string,
) {
  const steps: LiveNavigationStep[] = (route.steps ?? [])
    .map((step, index) => {
      const path = (step.path ?? [])
        .map((point) => toLngLatTuple(point))
        .filter((point): point is LngLatTuple => point !== null)
      const distanceMeters = Number.isFinite(step.distance) ? Number(step.distance) : 0
      const timeSeconds = Number.isFinite(step.time) ? Number(step.time) : 0

      return {
        instruction: step.instruction?.trim() || step.action?.trim() || `继续前往第 ${index + 1} 段路线`,
        distanceMeters: Math.max(0, Math.round(distanceMeters)),
        timeSeconds: Math.max(0, Math.round(timeSeconds)),
        path,
      }
    })
    .filter((step) => step.instruction || step.path.length)

  const path = steps.flatMap((step) => step.path)
  const routeDistance = Number.isFinite(route.distance)
    ? Number(route.distance)
    : steps.reduce((sum, step) => sum + step.distanceMeters, 0)
  const routeTime = Number.isFinite(route.time)
    ? Number(route.time)
    : steps.reduce((sum, step) => sum + step.timeSeconds, 0)

  return {
    destinationPlaceId,
    destinationName,
    distanceMeters: Math.max(0, Math.round(routeDistance)),
    timeSeconds: Math.max(0, Math.round(routeTime)),
    path,
    steps,
  } satisfies LiveNavigationRoute
}

function toRawBrowserLocation(position: GeolocationPosition): RawBrowserLocation {
  return {
    coords: [position.coords.longitude, position.coords.latitude],
    accuracy: position.coords.accuracy,
    heading: getPositionHeading(position),
    speed: getPositionSpeed(position),
    timestamp: position.timestamp,
  }
}

function requestRawBrowserLocation() {
  return new Promise<RawBrowserLocation>((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('当前浏览器不支持实时定位。'))
      return
    }

    let bestLocation: RawBrowserLocation | null = null
    let lastError: GeolocationPositionError | null = null
    let settled = false

    const finish = (location: RawBrowserLocation | null) => {
      if (settled) {
        return
      }

      settled = true
      window.clearTimeout(timeoutId)
      navigator.geolocation.clearWatch(watchId)

      if (location) {
        resolve(location)
        return
      }

      reject(new Error(lastError ? getGeolocationErrorMessage(lastError) : '暂时无法获取当前位置。'))
    }

    const timeoutId = window.setTimeout(() => finish(bestLocation), 14_000)
    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const nextLocation = toRawBrowserLocation(position)

        if (!bestLocation || nextLocation.accuracy < bestLocation.accuracy) {
          bestLocation = nextLocation
        }

        if (nextLocation.accuracy <= GOOD_ACCURACY_METERS) {
          finish(nextLocation)
        }
      },
      (error) => {
        lastError = error

        if (error.code === error.PERMISSION_DENIED) {
          finish(null)
        }
      },
      {
        enableHighAccuracy: true,
        maximumAge: 0,
        timeout: 12_000,
      },
    )
  })
}

export function AmapLiveMap({
  campus,
  endPlaceId,
  livePoi,
  places,
  selectedPlaceId,
  startPlaceId,
}: AmapLiveMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<AmapMapInstance | null>(null)
  const AMapRef = useRef<AmapNamespace | null>(null)
  const placeSearchRef = useRef<AmapPlaceSearchInstance | null>(null)
  const walkingRef = useRef<AmapWalkingInstance | null>(null)
  const sceneOverlaysRef = useRef<AmapMarkerInstance[]>([])
  const campusCenterRef = useRef<LngLatTuple>(DEFAULT_CENTER)
  const placeCacheRef = useRef(new Map<string, LngLatTuple>())
  const userMarkerRef = useRef<AmapMarkerInstance | null>(null)
  const userMarkerElementRef = useRef<HTMLDivElement | null>(null)
  const destinationMarkerRef = useRef<AmapMarkerInstance | null>(null)
  const watchIdRef = useRef<number | null>(null)
  const liveRouteRef = useRef<LiveNavigationRoute | null>(null)
  const currentStepIndexRef = useRef(0)
  const voiceEnabledRef = useRef(true)
  const headingDegreesRef = useRef<number | null>(null)
  const isHeadingTrackingRef = useRef(false)
  const orientationHandlerRef = useRef<((event: DeviceOrientationEvent) => void) | null>(null)
  const isNavigatingRef = useRef(false)
  const isReplanningRef = useRef(false)
  const destinationLocationRef = useRef<LngLatTuple | null>(null)
  const navigationTargetRef = useRef<PlaceRecord | null>(null)
  const lastRerouteAtRef = useRef(0)
  const lastSpokenTextRef = useRef('')
  const resolvePlaceLocationRef = useRef<(place: PlaceRecord) => Promise<LngLatTuple | null>>(
    async () => null,
  )
  const stopLiveNavigationRef = useRef<(nextStatus?: string, shouldUpdateStatus?: boolean) => void>(
    () => undefined,
  )
  const [status, setStatus] = useState('正在等待实景地图初始化。')
  const [error, setError] = useState('')
  const [isMapReady, setIsMapReady] = useState(false)
  const [isNavigating, setIsNavigating] = useState(false)
  const [isReplanning, setIsReplanning] = useState(false)
  const [voiceEnabled, setVoiceEnabled] = useState(true)
  const [voiceStatus, setVoiceStatus] = useState('语音需要在手机上点击按钮后解锁。')
  const [headingDegrees, setHeadingDegrees] = useState<number | null>(null)
  const [headingStatus, setHeadingStatus] = useState('方向传感器尚未启用。')
  const [locationWarning, setLocationWarning] = useState('')
  const [navigationStatus, setNavigationStatus] = useState('选择终点后，可从当前位置开始实时导航。')
  const [navigationError, setNavigationError] = useState('')
  const [currentLocation, setCurrentLocation] = useState<BrowserLocation | null>(null)
  const [liveRoute, setLiveRoute] = useState<LiveNavigationRoute | null>(null)
  const [currentStepIndex, setCurrentStepIndex] = useState(0)

  const keyedPlaces = useMemo(
    () => Object.fromEntries(places.map((place) => [place.id, place])),
    [places],
  )
  const selectedPlace = keyedPlaces[selectedPlaceId] ?? null
  const endPlace = keyedPlaces[endPlaceId] ?? null
  const navigationTargetPlace = endPlace ?? selectedPlace
  const currentInstruction = liveRoute?.steps[currentStepIndex]?.instruction ?? ''
  const remainingSteps = liveRoute?.steps.slice(currentStepIndex, currentStepIndex + 3) ?? []

  useEffect(() => {
    liveRouteRef.current = liveRoute
  }, [liveRoute])

  useEffect(() => {
    currentStepIndexRef.current = currentStepIndex
  }, [currentStepIndex])

  useEffect(() => {
    voiceEnabledRef.current = voiceEnabled
  }, [voiceEnabled])

  useEffect(() => {
    headingDegreesRef.current = headingDegrees

    if (headingDegrees !== null) {
      updateUserMarkerHeading(headingDegrees)
    }
  }, [headingDegrees])

  useEffect(() => {
    isNavigatingRef.current = isNavigating
  }, [isNavigating])

  useEffect(() => {
    navigationTargetRef.current = navigationTargetPlace
  }, [navigationTargetPlace])

  function createSpeechUtterance(text: string) {
    const utterance = new SpeechSynthesisUtterance(text)
    const voices = window.speechSynthesis.getVoices()
    const chineseVoice =
      voices.find((voice) => voice.lang.toLowerCase() === 'zh-cn') ??
      voices.find((voice) => voice.lang.toLowerCase().startsWith('zh')) ??
      null

    if (chineseVoice) {
      utterance.voice = chineseVoice
    }

    utterance.lang = chineseVoice?.lang ?? 'zh-CN'
    utterance.rate = 1
    utterance.pitch = 1
    utterance.volume = 1
    utterance.onstart = () => setVoiceStatus('正在语音播报。')
    utterance.onend = () => setVoiceStatus('语音已就绪。')
    utterance.onerror = () => {
      setVoiceStatus('语音被当前浏览器拦截或系统无可用中文语音，请点击“开启语音”并检查媒体音量。')
    }

    return utterance
  }

  function getNativeTtsBridge() {
    const bridge = window.CampusPulseNativeTTS

    if (!bridge) {
      return null
    }

    try {
      if (bridge.isAvailable && !bridge.isAvailable()) {
        return null
      }
    } catch {
      return null
    }

    return bridge
  }

  function canUseWebSpeech() {
    return 'speechSynthesis' in window && typeof SpeechSynthesisUtterance !== 'undefined'
  }

  function canUseSpeech() {
    return Boolean(getNativeTtsBridge()) || canUseWebSpeech()
  }

  function stopSpeech() {
    getNativeTtsBridge()?.stop?.()

    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel()
    }
  }

  function primeSpeechEngine(text = '语音导航已开启') {
    const nativeTtsBridge = getNativeTtsBridge()

    if (nativeTtsBridge) {
      nativeTtsBridge.stop?.()
      nativeTtsBridge.speak(text)
      lastSpokenTextRef.current = text
      setVoiceStatus('已调用移动端原生语音播报。')
      return true
    }

    if (!canUseWebSpeech()) {
      setVoiceStatus('当前环境没有可用语音引擎；移动端容器需接入原生 TTS 桥。')
      return false
    }

    window.speechSynthesis.cancel()
    window.speechSynthesis.resume()
    window.speechSynthesis.speak(createSpeechUtterance(text))
    lastSpokenTextRef.current = text
    setVoiceStatus('已请求语音播放；如果没声音，请检查媒体音量或浏览器语音权限。')
    return true
  }

  function speak(text: string, force = false) {
    if (
      !voiceEnabledRef.current ||
      !text ||
      !canUseSpeech()
    ) {
      return
    }

    if (!force && lastSpokenTextRef.current === text) {
      return
    }

    const nativeTtsBridge = getNativeTtsBridge()

    if (nativeTtsBridge) {
      nativeTtsBridge.stop?.()
      nativeTtsBridge.speak(text)
      setVoiceStatus('移动端原生语音正在播报。')
      lastSpokenTextRef.current = text
      return
    }

    window.speechSynthesis.cancel()
    window.speechSynthesis.resume()
    window.speechSynthesis.speak(createSpeechUtterance(text))
    lastSpokenTextRef.current = text
  }

  function updateUserMarkerHeading(heading: number | null) {
    if (heading === null) {
      return
    }

    userMarkerElementRef.current?.style.setProperty('--heading', `${normalizeHeading(heading)}deg`)
  }

  function handleDeviceOrientation(event: DeviceOrientationEvent) {
    const nextHeading = getCompassHeading(event)

    if (nextHeading === null) {
      return
    }

    headingDegreesRef.current = nextHeading
    setHeadingDegrees(nextHeading)
    setHeadingStatus(`方向传感器已启用：${Math.round(nextHeading)}°。`)
    updateUserMarkerHeading(nextHeading)
  }

  async function startHeadingTracking() {
    if (isHeadingTrackingRef.current) {
      return true
    }

    const orientationConstructor = window.DeviceOrientationEvent as
      | DeviceOrientationEventConstructorWithPermission
      | undefined

    if (!orientationConstructor) {
      setHeadingStatus('当前浏览器不支持方向传感器，箭头只能使用步行方向估计。')
      return false
    }

    try {
      if (typeof orientationConstructor.requestPermission === 'function') {
        const permission = await orientationConstructor.requestPermission()

        if (permission !== 'granted') {
          setHeadingStatus('方向传感器权限未授权，箭头无法随手机转动。')
          return false
        }
      }

      orientationHandlerRef.current = (event) => handleDeviceOrientation(event)
      window.addEventListener('deviceorientationabsolute', orientationHandlerRef.current, true)
      window.addEventListener('deviceorientation', orientationHandlerRef.current, true)
      isHeadingTrackingRef.current = true
      setHeadingStatus('方向传感器已启用，转动手机时箭头会同步旋转。')
      return true
    } catch {
      setHeadingStatus('方向传感器启动失败，请在浏览器权限中允许运动与方向访问。')
      return false
    }
  }

  function stopHeadingTracking() {
    if (!isHeadingTrackingRef.current) {
      return
    }

    if (orientationHandlerRef.current) {
      window.removeEventListener('deviceorientationabsolute', orientationHandlerRef.current, true)
      window.removeEventListener('deviceorientation', orientationHandlerRef.current, true)
      orientationHandlerRef.current = null
    }

    isHeadingTrackingRef.current = false
  }

  function clearSceneOverlays() {
    sceneOverlaysRef.current.forEach((overlay) => overlay?.setMap?.(null))
    sceneOverlaysRef.current = []
    walkingRef.current?.clear?.()
  }

  function clearNavigationMarkers() {
    userMarkerRef.current?.setMap(null)
    destinationMarkerRef.current?.setMap(null)
    userMarkerRef.current = null
    userMarkerElementRef.current = null
    destinationMarkerRef.current = null
  }

  function addMarker(
    position: LngLatTuple,
    title: string,
    labelClassName = 'amap-live-label',
    labelPrefix = '',
  ) {
    const AMap = AMapRef.current

    if (!AMap || !mapRef.current) {
      return
    }

    const marker = new AMap.Marker({
      position,
      title,
      label: {
        content: `<div class="${labelClassName}">${labelPrefix}${title}</div>`,
      },
    })

    sceneOverlaysRef.current.push(marker)
    marker.setMap(mapRef.current)
  }

  function updateUserMarker(location: BrowserLocation) {
    const map = mapRef.current
    const AMap = AMapRef.current

    if (!map || !AMap) {
      return
    }

    if (userMarkerRef.current?.setPosition) {
      userMarkerRef.current.setPosition(location.coords)
      updateUserMarkerHeading(headingDegreesRef.current ?? location.heading)
      return
    }

    const markerContent = document.createElement('div')
    markerContent.className = 'amap-user-marker'
    markerContent.innerHTML = '<span class="amap-user-marker__arrow"></span>'
    userMarkerElementRef.current = markerContent
    updateUserMarkerHeading(headingDegreesRef.current ?? location.heading)

    const marker = new AMap.Marker({
      position: location.coords,
      title: '当前位置',
      zIndex: 120,
      content: markerContent,
    })

    userMarkerRef.current = marker
    marker.setMap(map)
  }

  function setDestinationMarker(position: LngLatTuple, title: string) {
    const map = mapRef.current
    const AMap = AMapRef.current

    if (!map || !AMap) {
      return
    }

    destinationMarkerRef.current?.setMap(null)
    destinationMarkerRef.current = new AMap.Marker({
      position,
      title,
      zIndex: 110,
      label: {
        content: `<div class="amap-live-label amap-live-label--end">终 ${title}</div>`,
      },
    })
    destinationMarkerRef.current.setMap(map)
  }

  async function searchKeyword(keyword: string) {
    return await new Promise<AmapPoiRecord[]>((resolve) => {
      placeSearchRef.current?.search(keyword, (searchStatus: string, result: AmapPoiResult) => {
        if (searchStatus !== 'complete' || !result?.poiList?.pois?.length) {
          resolve([])
          return
        }

        resolve(result.poiList.pois)
      })
    })
  }

  async function resolvePlaceLocation(place: PlaceRecord) {
    const cached = placeCacheRef.current.get(place.id)

    if (cached) {
      return cached
    }

    for (const query of getPlaceQueries(campus, place)) {
      const pois = await searchKeyword(query)
      const candidates = pois
        .map((poi) => toLngLatTuple(poi.location))
        .filter((value): value is LngLatTuple => value !== null)

      if (!candidates.length) {
        continue
      }

      const nearby = candidates
        .map((candidate) => ({
          candidate,
          distance: haversineDistance(campusCenterRef.current, candidate),
        }))
        .sort((left, right) => left.distance - right.distance)

      const bestCandidate =
        nearby.find((item) => item.distance <= CAMPUS_MAX_DISTANCE_METERS)?.candidate ??
        candidates[0]

      placeCacheRef.current.set(place.id, bestCandidate)
      return bestCandidate
    }

    return null
  }

  async function convertRawLocationToAmap(rawLocation: RawBrowserLocation): Promise<BrowserLocation> {
    const AMap = AMapRef.current

    if (!AMap?.convertFrom) {
      return {
        ...rawLocation,
        rawCoords: rawLocation.coords,
        coordinateSystem: 'wgs84',
      }
    }

    return await new Promise<BrowserLocation>((resolve) => {
      AMap.convertFrom?.(rawLocation.coords, 'gps', (convertStatus, result) => {
        const convertedLocation =
          convertStatus === 'complete' ? toLngLatTuple(result.locations?.[0]) : null

        resolve({
          ...rawLocation,
          coords: convertedLocation ?? rawLocation.coords,
          rawCoords: rawLocation.coords,
          coordinateSystem: convertedLocation ? 'gcj02' : 'wgs84',
        })
      })
    })
  }

  function applyLocationDiagnostics(location: BrowserLocation) {
    setLocationWarning(getAccuracyMessage(location))

    if (headingDegreesRef.current === null && location.heading !== null) {
      headingDegreesRef.current = location.heading
      setHeadingDegrees(location.heading)
      updateUserMarkerHeading(location.heading)
      setHeadingStatus(`使用 GPS 步行方向估计箭头：${Math.round(location.heading)}°。`)
    }
  }

  async function rebuildRouteFromPosition(
    location: BrowserLocation,
    targetPlace: PlaceRecord,
    destinationLocation: LngLatTuple,
    reason: 'start' | 'reroute',
  ) {
    if (!walkingRef.current) {
      throw new Error('高德步行规划尚未初始化。')
    }

    isReplanningRef.current = true
    setIsReplanning(true)

    try {
      walkingRef.current.clear?.()

      const nextRoute = await new Promise<LiveNavigationRoute>((resolve, reject) => {
        walkingRef.current?.search(location.coords, destinationLocation, (searchStatus, result) => {
          if (searchStatus !== 'complete' || typeof result === 'string' || !result.routes?.length) {
            reject(new Error('地图服务未返回可用步行路线，请稍后重试或改用校园拓扑。'))
            return
          }

          resolve(normalizeWalkingRoute(result.routes[0], targetPlace.id, targetPlace.name))
        })
      })

      if (!isNavigatingRef.current) {
        return
      }

      setLiveRoute(nextRoute)
      liveRouteRef.current = nextRoute
      setCurrentStepIndex(0)
      currentStepIndexRef.current = 0
      const nextInstruction = nextRoute.steps[0]?.instruction ?? `向 ${targetPlace.name} 前进`
      setNavigationStatus(
        reason === 'reroute'
          ? `已根据当前位置重新规划，下一步：${nextInstruction}`
          : `实时导航已开始，下一步：${nextInstruction}`,
      )
      speak(reason === 'reroute' ? `已重新规划路线。${nextInstruction}` : `开始导航。${nextInstruction}`, true)
    } finally {
      isReplanningRef.current = false
      setIsReplanning(false)
    }
  }

  async function handleNavigationPosition(location: BrowserLocation) {
    setCurrentLocation(location)
    applyLocationDiagnostics(location)
    updateUserMarker(location)
    mapRef.current?.setCenter(location.coords)

    const route = liveRouteRef.current
    const targetPlace = navigationTargetRef.current
    const destinationLocation = destinationLocationRef.current

    if (!route || !targetPlace || !destinationLocation) {
      return
    }

    const arrivalDistance = haversineDistance(location.coords, destinationLocation)

    if (arrivalDistance <= ARRIVAL_DISTANCE_METERS) {
      setNavigationStatus(`已到达 ${route.destinationName} 附近。`)
      speak(`已到达 ${route.destinationName} 附近，导航结束。`, true)
      stopLiveNavigation('已到达目的地。')
      return
    }

    let nextStepIndex = currentStepIndexRef.current

    while (nextStepIndex < route.steps.length - 1) {
      const stepEndPoint = getStepEndPoint(route.steps[nextStepIndex])

      if (!stepEndPoint || haversineDistance(location.coords, stepEndPoint) > STEP_ADVANCE_DISTANCE_METERS) {
        break
      }

      nextStepIndex += 1
    }

    if (nextStepIndex !== currentStepIndexRef.current) {
      currentStepIndexRef.current = nextStepIndex
      setCurrentStepIndex(nextStepIndex)
      const nextInstruction = route.steps[nextStepIndex]?.instruction ?? '继续沿路线前进'
      setNavigationStatus(`即将进入下一段：${nextInstruction}`)
      speak(nextInstruction, true)
    } else if (route.steps[nextStepIndex]?.instruction) {
      setNavigationStatus(`继续导航：${route.steps[nextStepIndex].instruction}`)
    }

    const routeDistance = distanceToPathMeters(location.coords, route.path)
    const deviationThreshold = Math.max(
      ROUTE_DEVIATION_DISTANCE_METERS,
      Math.round(location.accuracy * 1.5),
    )
    const now = Date.now()

    if (
      route.path.length &&
      routeDistance > deviationThreshold &&
      now - lastRerouteAtRef.current > REROUTE_COOLDOWN_MS &&
      !isReplanningRef.current
    ) {
      lastRerouteAtRef.current = now
      setNavigationStatus('检测到当前位置偏离原路线，正在重新规划。')
      speak('检测到偏离路线，正在重新规划。', true)
      await rebuildRouteFromPosition(location, targetPlace, destinationLocation, 'reroute').catch((nextError) => {
        setNavigationError(nextError instanceof Error ? nextError.message : '重新规划失败。')
      })
    }
  }

  async function startLiveNavigation() {
    if (!isMapReady || !mapRef.current || !placeSearchRef.current || !walkingRef.current) {
      setNavigationError('地图服务还没有初始化完成，请稍后再开始导航。')
      return
    }

    if (!navigationTargetPlace) {
      setNavigationError('请先选择一个终点，或点选地图/列表中的目标地点。')
      return
    }

    if (!navigator.geolocation) {
      setNavigationError('当前浏览器不支持实时定位。')
      return
    }

    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current)
      watchIdRef.current = null
    }

    setIsNavigating(true)
    isNavigatingRef.current = true
    setNavigationError('')
    setLiveRoute(null)
    liveRouteRef.current = null
    setCurrentStepIndex(0)
    currentStepIndexRef.current = 0
    lastSpokenTextRef.current = ''
    setLocationWarning('')
    setNavigationStatus('正在获取当前位置，请允许浏览器使用定位。')
    primeSpeechEngine('语音导航已开启，正在获取当前位置。')
    void startHeadingTracking()

    try {
      const rawLocation = await requestRawBrowserLocation()
      const location = await convertRawLocationToAmap(rawLocation)

      if (!isNavigatingRef.current) {
        return
      }

      setCurrentLocation(location)
      applyLocationDiagnostics(location)
      updateUserMarker(location)
      const destinationLocation = await resolvePlaceLocation(navigationTargetPlace)

      if (!destinationLocation) {
        throw new Error(`地图服务暂未精确识别 ${navigationTargetPlace.name}，无法开始实时导航。`)
      }

      destinationLocationRef.current = destinationLocation
      setDestinationMarker(destinationLocation, navigationTargetPlace.name)
      await rebuildRouteFromPosition(location, navigationTargetPlace, destinationLocation, 'start')

      watchIdRef.current = navigator.geolocation.watchPosition(
        (position) => {
          void convertRawLocationToAmap(toRawBrowserLocation(position)).then((nextLocation) => {
            void handleNavigationPosition(nextLocation)
          })
        },
        (nextError) => {
          const message = getGeolocationErrorMessage(nextError)
          setNavigationError(message)
          setNavigationStatus('定位信号不稳定，请步行到开阔地带，系统会继续等待新位置。')
          speak('定位信号不稳定，请步行到开阔地带。')
        },
        {
          enableHighAccuracy: true,
          maximumAge: 1_000,
          timeout: 10_000,
        },
      )
    } catch (nextError) {
      setNavigationError(nextError instanceof Error ? nextError.message : '实时导航启动失败。')
      setNavigationStatus('实时导航未能启动，请检查定位权限、网络和终点是否可识别。')
      setIsNavigating(false)
      isNavigatingRef.current = false
    }
  }

  function stopLiveNavigation(nextStatus = '实时导航已退出。', shouldUpdateStatus = true) {
    if (watchIdRef.current !== null && navigator.geolocation) {
      navigator.geolocation.clearWatch(watchIdRef.current)
      watchIdRef.current = null
    }

    stopSpeech()
    stopHeadingTracking()
    isNavigatingRef.current = false
    isReplanningRef.current = false
    setIsNavigating(false)
    setIsReplanning(false)
    if (shouldUpdateStatus) {
      setNavigationStatus(nextStatus)
    }
    setLiveRoute(null)
    liveRouteRef.current = null
    setCurrentStepIndex(0)
    currentStepIndexRef.current = 0
    setHeadingDegrees(null)
    headingDegreesRef.current = null
    setLocationWarning('')
    destinationLocationRef.current = null
    walkingRef.current?.clear?.()
    clearNavigationMarkers()
  }

  function toggleVoice() {
    const nextVoiceState = !voiceEnabledRef.current
    voiceEnabledRef.current = nextVoiceState
    setVoiceEnabled(nextVoiceState)

    if (!nextVoiceState) {
      stopSpeech()
      setVoiceStatus('语音已关闭。')
      return
    }

    primeSpeechEngine(currentInstruction || '语音导航已开启。')
  }

  useEffect(() => {
    resolvePlaceLocationRef.current = resolvePlaceLocation
    stopLiveNavigationRef.current = stopLiveNavigation
  })

  useEffect(() => {
    let cancelled = false

    async function initMap() {
      const amapKey = import.meta.env.VITE_AMAP_JSAPI_KEY
      const securityJsCode = import.meta.env.VITE_AMAP_SECURITY_JS_CODE

      if (!amapKey || !securityJsCode) {
        setError('当前环境未配置高德地图 JSAPI 前端凭据，无法加载高德实景底图。')
        setStatus('请在 `.env.local` 配置 `VITE_AMAP_JSAPI_KEY` 和 `VITE_AMAP_SECURITY_JS_CODE`。')
        return
      }

      if (!containerRef.current) {
        return
      }

      try {
        const { default: AMapLoader } = await import('@amap/amap-jsapi-loader')

        window._AMapSecurityConfig = {
          securityJsCode,
        }

        const AMap = (await AMapLoader.load({
          key: amapKey,
          version: '2.0',
          plugins: [
            'AMap.Scale',
            'AMap.ToolBar',
            'AMap.MapType',
            'AMap.PlaceSearch',
            'AMap.Geolocation',
            'AMap.Walking',
          ],
        })) as AmapNamespace

        if (cancelled || !containerRef.current) {
          return
        }

        const map = new AMap.Map(containerRef.current, {
          viewMode: '3D',
          zoom: DEFAULT_ZOOM,
          center: DEFAULT_CENTER,
          mapStyle: 'amap://styles/normal',
        })

        map.addControl(new AMap.Scale())
        map.addControl(new AMap.ToolBar({ position: 'RB' }))
        map.addControl(new AMap.MapType({ position: 'RT' }))
        map.addControl(
          new AMap.Geolocation({
            position: 'LB',
            showCircle: true,
            showMarker: true,
            enableHighAccuracy: true,
            timeout: 10_000,
            GeoLocationFirst: true,
          }),
        )

        const placeSearch = new AMap.PlaceSearch({
          city: '青岛市',
          pageSize: 8,
          pageIndex: 1,
          citylimit: false,
          autoFitView: false,
        })

        AMapRef.current = AMap
        mapRef.current = map
        placeSearchRef.current = placeSearch
        walkingRef.current = new AMap.Walking({
          map,
          hideMarkers: true,
          autoFitView: true,
          isOutline: true,
          outlineColor: '#ffffff',
        })

        for (const query of getCampusQueries(campus)) {
          const center = await new Promise<LngLatTuple | null>((resolve) => {
            placeSearch.search(query, (searchStatus: string, result: AmapPoiResult) => {
              if (searchStatus !== 'complete' || !result?.poiList?.pois?.length) {
                resolve(null)
                return
              }

              resolve(toLngLatTuple(result.poiList.pois[0].location))
            })
          })

          if (center) {
            campusCenterRef.current = center
            map.setCenter(center)
            map.setZoom(DEFAULT_ZOOM)
            break
          }
        }

        setIsMapReady(true)
        setError('')
        setStatus('高德实景地图已就绪，可查看真实底图、实时定位、步行路线和语音导航。')
      } catch (nextError) {
        setError(nextError instanceof Error ? nextError.message : '地图服务加载失败。')
        setStatus('高德地图服务初始化失败，请检查本地凭据或网络状态。')
      }
    }

    void initMap()

    return () => {
      cancelled = true
      stopLiveNavigationRef.current('实时导航已退出。', false)
      clearSceneOverlays()
      mapRef.current?.destroy?.()
      mapRef.current = null
      setIsMapReady(false)
    }
  }, [campus])

  useEffect(() => {
    let cancelled = false

    async function updateScene() {
      if (!mapRef.current || !placeSearchRef.current || !AMapRef.current) {
        return
      }

      if (isNavigatingRef.current) {
        return
      }

      clearSceneOverlays()
      setError('')

      const startPlace = keyedPlaces[startPlaceId]
      const selectedScenePlace = keyedPlaces[selectedPlaceId]

      if (livePoi) {
        const location: LngLatTuple = [livePoi.lng, livePoi.lat]
        addMarker(location, livePoi.name)
        mapRef.current.setCenter(location)
        mapRef.current.setZoom(18)
        setStatus(`已在实景地图中定位 ${livePoi.name}。`)
        return
      }

      if (startPlace && endPlace) {
        setStatus('正在尝试用实景地图查询这两个点位的真实位置。')

        const [startLocation, endLocation] = await Promise.all([
          resolvePlaceLocationRef.current(startPlace),
          resolvePlaceLocationRef.current(endPlace),
        ])

        if (cancelled) {
          return
        }

        if (!startLocation || !endLocation) {
          setError('地图服务暂未准确识别这组校内点位，仍可继续使用本地路网路线。')
          setStatus('真实底图已加载，但这条校内路线仍建议以本地路网结果为准。')
          return
        }

        addMarker(startLocation, startPlace.name, 'amap-live-label', '起 ')
        addMarker(endLocation, endPlace.name, 'amap-live-label amap-live-label--end', '终 ')

        setStatus('地图服务正在规划真实步行路线。')

        walkingRef.current?.search(
          startLocation,
          endLocation,
          (searchStatus: string, result: AmapWalkingResult | string) => {
            if (cancelled) {
              return
            }

            if (searchStatus === 'complete' && typeof result !== 'string' && result?.routes?.length) {
              setStatus('实景步行路线已生成，可点击“开始实时导航”切换为当前位置引导。')
              return
            }

            setError('地图服务未返回可用步行路线，可能因为校内道路未完整收录。')
            setStatus('当前仍建议以本地路网中的校内步行路线为主。')
          },
        )

        return
      }

      if (selectedScenePlace) {
        setStatus(`正在实景地图中定位 ${selectedScenePlace.name}。`)
        const location = await resolvePlaceLocationRef.current(selectedScenePlace)

        if (cancelled) {
          return
        }

        if (!location) {
          setError(`地图服务暂未精确识别 ${selectedScenePlace.name}，可以继续参考本地路网图。`)
          setStatus('实景地图已加载，但当前点位未成功匹配。')
          return
        }

        addMarker(location, selectedScenePlace.name)
        mapRef.current.setCenter(location)
        mapRef.current.setZoom(17)
        setStatus(`已在实景地图中定位 ${selectedScenePlace.name}。`)
        return
      }

      mapRef.current.setCenter(campusCenterRef.current)
      mapRef.current.setZoom(DEFAULT_ZOOM)
      setStatus('实景地图已加载，可切换起终点、点击本地点位或实时地点进行查看。')
    }

    void updateScene()

    return () => {
      cancelled = true
    }
  }, [campus, endPlace, keyedPlaces, livePoi, selectedPlaceId, startPlaceId])

  useEffect(() => {
    if (!isNavigating || !liveRoute || !navigationTargetPlace) {
      return
    }

    if (navigationTargetPlace.id !== liveRoute.destinationPlaceId) {
      stopLiveNavigationRef.current('终点已改变，已结束当前实时导航，请重新开始。')
    }
  }, [isNavigating, liveRoute, navigationTargetPlace])

  return (
    <div className="amap-panel">
      <div ref={containerRef} className="amap-panel__container" aria-label="实景地图" />
      <section className="amap-navigation-card" aria-labelledby="live-navigation-title">
        <div className="amap-navigation-card__header">
          <div>
            <strong id="live-navigation-title">实时步行导航</strong>
            <p>
              目标：
              {navigationTargetPlace ? navigationTargetPlace.name : '请先选择终点或点选地点'}
            </p>
          </div>
          <span className={isNavigating ? 'live-navigation-badge live-navigation-badge--active' : 'live-navigation-badge'}>
            {isNavigating ? (isReplanning ? '重规划中' : '导航中') : '待开始'}
          </span>
        </div>

        <div className="amap-navigation-card__actions">
          <button
            type="button"
            className="amap-navigation-card__primary"
            disabled={!isMapReady || !navigationTargetPlace}
            onClick={() => {
              if (isNavigating) {
                stopLiveNavigation()
                return
              }

              void startLiveNavigation()
            }}
          >
            {isNavigating ? '结束实时导航' : '开始实时导航'}
          </button>
          <button type="button" className="amap-navigation-card__secondary" onClick={toggleVoice}>
            {voiceEnabled ? '关闭语音' : '开启语音'}
          </button>
        </div>

        <p className="amap-navigation-card__status" aria-live="polite">
          {navigationStatus}
        </p>
        <p className="amap-navigation-card__substatus">{headingStatus}</p>
        <p className="amap-navigation-card__substatus">{voiceStatus}</p>
        {locationWarning ? <p className="amap-navigation-card__warning">{locationWarning}</p> : null}
        {navigationError ? <p className="amap-panel__error">{navigationError}</p> : null}

        <div className="amap-navigation-metrics">
          <div>
            <span>路线距离</span>
            <strong>{liveRoute ? formatDistance(liveRoute.distanceMeters) : '未生成'}</strong>
          </div>
          <div>
            <span>预计步行</span>
            <strong>{liveRoute ? formatDuration(liveRoute.timeSeconds) : '未生成'}</strong>
          </div>
          <div>
            <span>定位精度</span>
            <strong>{currentLocation ? `约 ${Math.round(currentLocation.accuracy)} 米` : '未定位'}</strong>
          </div>
          <div>
            <span>箭头方向</span>
            <strong>
              {headingDegrees !== null
                ? `${Math.round(headingDegrees)}°`
                : currentLocation?.heading !== null && currentLocation?.heading !== undefined
                  ? `${Math.round(currentLocation.heading)}°`
                  : '未获取'}
            </strong>
          </div>
        </div>

        {currentInstruction ? (
          <div className="amap-navigation-card__instruction">
            <span>下一步</span>
            <strong>{currentInstruction}</strong>
          </div>
        ) : null}

        {remainingSteps.length ? (
          <ol className="amap-navigation-steps">
            {remainingSteps.map((step, index) => (
              <li key={`${step.instruction}-${index}`}>
                <span>{currentStepIndex + index + 1}</span>
                <p>{step.instruction}</p>
                <small>{formatDistance(step.distanceMeters)}</small>
              </li>
            ))}
          </ol>
        ) : null}
      </section>
      <div className="amap-panel__status" aria-live="polite">
        <strong>实景地图</strong>
        <p>{status}</p>
        {error ? <p className="amap-panel__error">{error}</p> : null}
      </div>
    </div>
  )
}
