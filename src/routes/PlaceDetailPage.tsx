import { Link, useLocation, useParams } from 'react-router-dom'

import { campusConfig } from '../data/campus'
import { places } from '../data/places'
import {
  getCategoryAccent,
  getCategoryIcon,
  getCategoryLabel,
  getPlaceById,
  getRelatedPlaces,
} from '../lib/navigation'

export function PlaceDetailPage() {
  const { placeId } = useParams()
  const location = useLocation()
  const place = getPlaceById(places, placeId)

  if (!place) {
    return (
      <div className="detail-shell detail-shell--missing">
        <p className="control-card__eyebrow">地点不存在</p>
        <h1>未找到该地点</h1>
        <p>当前链接对应的地点不在本地数据中，可能已被移除或尚未录入。</p>
        <Link className="detail-shell__back" to={`/${location.search}`}>
          返回首页重新查看
        </Link>
      </div>
    )
  }

  const accent = getCategoryAccent(place.categoryId)
  const relatedPlaces = getRelatedPlaces(places, place)

  return (
    <div className="detail-shell">
      <div className="detail-shell__hero">
        <div className="detail-shell__hero-copy">
          <p className="control-card__eyebrow">{campusConfig.name}</p>
          <h1>{place.name}</h1>
          <div className="detail-shell__badges">
            <span className="detail-shell__badge" style={{ borderColor: accent, color: accent }}>
              {getCategoryIcon(place.categoryId)} {getCategoryLabel(place.categoryId)}
            </span>
            <span className="detail-shell__badge">{place.zone}</span>
          </div>
          <p className="detail-shell__summary">{place.description}</p>
          <div className="detail-shell__actions">
            <Link className="detail-shell__back" to={`/${location.search}`}>
              返回地图首页
            </Link>
            <span className="detail-shell__inline-note">
              支持直达链接，适合分享到班群、迎新页或课程展示页面。
            </span>
          </div>
        </div>
        <div className="detail-shell__map-note">
          <img src={campusConfig.mapAsset} alt="" />
          <p>{campusConfig.mapNote}</p>
        </div>
      </div>

      <div className="detail-shell__grid">
        <section className="detail-card">
          <p className="control-card__eyebrow">行动提示</p>
          <h2>抵达这个点位的建议</h2>
          <p>{place.arrivalTips}</p>
        </section>
        <section className="detail-card">
          <p className="control-card__eyebrow">识别词</p>
          <h2>搜索时可用这些词</h2>
          <div className="detail-card__tags">
            {place.aliases.map((alias) => (
              <span key={alias}>{alias}</span>
            ))}
            {place.keywords.map((keyword) => (
              <span key={keyword}>{keyword}</span>
            ))}
          </div>
        </section>
        <section className="detail-card">
          <p className="control-card__eyebrow">邻近任务</p>
          <h2>同场景带或同类别推荐</h2>
          <div className="detail-card__related">
            {relatedPlaces.map((relatedPlace) => (
              <Link
                key={relatedPlace.id}
                className="detail-card__related-link"
                to={`/place/${relatedPlace.id}${location.search}`}
              >
                <strong>{relatedPlace.name}</strong>
                <span>{relatedPlace.zone}</span>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}
