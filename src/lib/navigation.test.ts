import { describe, expect, it } from 'vitest'

import { places } from '../data/places'
import {
  defaultFilters,
  filterPlaces,
  getMarkerPositionStyle,
} from './navigation'

describe('filterPlaces', () => {
  it('matches aliases in search', () => {
    const result = filterPlaces(places, {
      ...defaultFilters,
      q: '新图书馆',
    })

    expect(result.map((place) => place.id)).toContain('library-information-center')
  })

  it('matches newly added landmark keywords in search', () => {
    const result = filterPlaces(places, {
      ...defaultFilters,
      q: '若水园',
    })

    expect(result.map((place) => place.id)).toContain('ruoshui-garden')
  })

  it('filters by category', () => {
    const result = filterPlaces(places, {
      ...defaultFilters,
      category: 'library',
    })

    expect(result).toHaveLength(1)
    expect(result[0]?.id).toBe('library-information-center')
  })

  it('filters by zone', () => {
    const result = filterPlaces(places, {
      ...defaultFilters,
      zone: '西部门户区',
    })

    expect(result.every((place) => place.zone === '西部门户区')).toBe(true)
  })

  it('returns empty array when nothing matches', () => {
    const result = filterPlaces(places, {
      ...defaultFilters,
      q: '完全不存在的地点',
    })

    expect(result).toHaveLength(0)
  })
})

describe('getMarkerPositionStyle', () => {
  it('keeps percentage coordinates for responsive markers', () => {
    expect(getMarkerPositionStyle({ xPct: 48.5, yPct: 72 })).toEqual({
      left: '48.5%',
      top: '72%',
    })
  })
})
