import { getCategoryAccent, getCategoryLabel } from '../lib/navigation'
import type { PlaceRecord } from '../types/navigation'

interface PlaceListProps {
  activePlaceId: string
  endPlaceId: string
  places: PlaceRecord[]
  selectedPlaceId: string
  startPlaceId: string
  onPlaceEnter: (placeId: string) => void
  onPlaceLeave: () => void
  onPlaceSelect: (placeId: string) => void
}

export function PlaceList({
  activePlaceId,
  endPlaceId,
  places,
  selectedPlaceId,
  startPlaceId,
  onPlaceEnter,
  onPlaceLeave,
  onPlaceSelect,
}: PlaceListProps) {
  return (
    <section className="list-card" aria-labelledby="list-title">
      <div className="list-card__header">
        <div>
          <p className="control-card__eyebrow">地点队列</p>
          <h2 id="list-title">从结果列表调取地点</h2>
        </div>
        <p className="list-card__hint">点击条目会同步高亮地图和右侧预览</p>
      </div>
      <ul className="place-list">
        {places.map((place) => {
          const isActive = activePlaceId === place.id
          const isSelected = selectedPlaceId === place.id
          const isStart = startPlaceId === place.id
          const isEnd = endPlaceId === place.id
          const accent = getCategoryAccent(place.categoryId)

          return (
            <li key={place.id}>
              <article
                className={isSelected ? 'place-item place-item--selected' : 'place-item'}
                onMouseEnter={() => onPlaceEnter(place.id)}
                onMouseLeave={onPlaceLeave}
              >
                <div className="place-item__meta">
                  <span
                    className="place-item__category"
                    style={{ borderColor: accent, color: accent }}
                  >
                    {getCategoryLabel(place.categoryId)}
                  </span>
                  <span className="place-item__zone">{place.zone}</span>
                  {isStart ? <span className="place-item__route-flag">起点</span> : null}
                  {isEnd ? <span className="place-item__route-flag place-item__route-flag--end">终点</span> : null}
                </div>
                <button
                  type="button"
                  className={
                    isActive
                      ? 'place-item__trigger place-item__trigger--active'
                      : 'place-item__trigger'
                  }
                  aria-label={`预览 ${place.name}`}
                  aria-pressed={isActive}
                  onFocus={() => onPlaceEnter(place.id)}
                  onBlur={onPlaceLeave}
                  onClick={() => onPlaceSelect(place.id)}
                >
                  <span>{place.name}</span>
                  <small>{place.aliases[0] ?? '校内点位'}</small>
                </button>
                <p>{place.description}</p>
                <div className="place-item__tags">
                  {place.keywords.slice(0, 3).map((keyword) => (
                    <span key={keyword}>{keyword}</span>
                  ))}
                </div>
              </article>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
