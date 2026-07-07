interface EmptyStateProps {
  onReset: () => void
}

export function EmptyState({ onReset }: EmptyStateProps) {
  return (
    <section className="empty-state" aria-live="polite">
      <p className="control-card__eyebrow">无匹配结果</p>
      <h2>当前筛选下没有找到地点</h2>
      <p>可以尝试清空关键词、切换分类，或回到全部区域重新浏览首批录入点位。</p>
      <button type="button" className="empty-state__button" onClick={onReset}>
        重置筛选
      </button>
    </section>
  )
}
