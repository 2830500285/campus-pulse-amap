import type { CampusConfig } from '../types/navigation'

interface ZoneCard {
  name: string
  summary: string
}

interface CampusOverviewProps {
  campus: CampusConfig
  zones: readonly ZoneCard[]
  activeZone: string
  onZoneChange: (zoneName: string) => void
}

export function CampusOverview({
  campus,
  zones,
  activeZone,
  onZoneChange,
}: CampusOverviewProps) {
  return (
    <section className="overview-card" aria-labelledby="overview-title">
      <div className="overview-card__lead">
        <p className="overview-card__eyebrow">空间分层</p>
        <h2 id="overview-title">{campus.name}</h2>
        <p>{campus.description}</p>
      </div>
      <div className="overview-card__toolbar">
        <label className="overview-card__select">
          <span>场景带筛选</span>
          <select value={activeZone} onChange={(event) => onZoneChange(event.target.value)}>
            <option value="all">全部区域</option>
            {zones.map((zone) => (
              <option key={zone.name} value={zone.name}>
                {zone.name}
              </option>
            ))}
          </select>
        </label>
        <p className="overview-card__note">{campus.mapNote}</p>
      </div>
      <div className="zone-grid">
        {zones.map((zone) => (
          <button
            key={zone.name}
            type="button"
            className={activeZone === zone.name ? 'zone-card zone-card--active' : 'zone-card'}
            onClick={() => onZoneChange(activeZone === zone.name ? 'all' : zone.name)}
          >
            <strong>{zone.name}</strong>
            <span>{zone.summary}</span>
          </button>
        ))}
      </div>
    </section>
  )
}
