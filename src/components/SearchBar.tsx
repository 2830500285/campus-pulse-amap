interface SearchBarProps {
  count: number
  total: number
  value: string
  onChange: (nextValue: string) => void
}

export function SearchBar({ count, total, value, onChange }: SearchBarProps) {
  return (
    <section className="control-card control-card--search" aria-labelledby="search-title">
      <div className="control-card__header">
        <p className="control-card__eyebrow">快速定位</p>
        <h2 id="search-title">按地点、别名或用途检索</h2>
      </div>
      <div className="search-bar">
        <label className="search-bar__label" htmlFor="site-search">
          搜索地点
        </label>
        <div className="search-bar__field">
          <span aria-hidden="true" className="search-bar__icon">
            搜
          </span>
          <input
            id="site-search"
            name="site-search"
            type="search"
            placeholder="例如：图书馆、J6、若水园、A17公寓"
            value={value}
            onChange={(event) => onChange(event.target.value)}
          />
        </div>
      </div>
      <div className="search-bar__meta">
        <strong>{count}</strong>
        <span>个匹配结果 / 当前内置 {total} 个可规划点位</span>
      </div>
    </section>
  )
}
