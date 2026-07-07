import { getPlaceName } from '../lib/navigation'
import type { PlaceRecord, PlannedRoute } from '../types/navigation'

interface RouteSummaryProps {
  places: PlaceRecord[]
  route: PlannedRoute | null
}

export function RouteSummary({ places, route }: RouteSummaryProps) {
  if (!route) {
    return (
      <section className="support-card" aria-labelledby="route-summary-title">
        <p className="control-card__eyebrow">行程摘要</p>
        <h2 id="route-summary-title">等待路线输入</h2>
        <p className="overview-card__note">选好两端后，这里会显示总距离、预计耗时和逐段行动提示。</p>
      </section>
    )
  }

  return (
    <section className="support-card route-summary-card" aria-labelledby="route-summary-title">
      <p className="control-card__eyebrow">行程摘要</p>
      <h2 id="route-summary-title">
        {getPlaceName(places, route.startPlaceId)} 到 {getPlaceName(places, route.endPlaceId)}
      </h2>
      <div className="route-summary-metrics">
        <div>
          <strong>总距离</strong>
          <span>{route.distanceMeters} 米</span>
        </div>
        <div>
          <strong>预计耗时</strong>
          <span>{route.estimatedMinutes} 分钟</span>
        </div>
      </div>
      <ol className="route-step-list">
        {route.steps.map((step) => (
          <li key={step.edgeId}>
            <strong>{step.fromLabel}</strong>
            <p>{step.instruction}</p>
            <span>{step.distanceMeters} 米</span>
          </li>
        ))}
      </ol>
    </section>
  )
}
