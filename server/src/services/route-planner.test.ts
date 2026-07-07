import { describe, expect, it } from 'vitest'

import { graphEdges, graphNodes, places } from '../data/navigation-seed.js'
import { RoutePlanner } from './route-planner.js'

describe('RoutePlanner', () => {
  const planner = new RoutePlanner(graphNodes, graphEdges, places)

  it('plans a valid route between west gate and library', () => {
    const route = planner.planRoute('west-gate', 'library-information-center')

    expect(route.distanceMeters).toBeGreaterThan(0)
    expect(route.pathPoints.length).toBeGreaterThan(2)
    expect(route.steps[0]?.instruction).toContain('西门')
  })

  it('returns a no-op route when start and end are the same', () => {
    const route = planner.planRoute('west-gate', 'west-gate')

    expect(route.distanceMeters).toBe(0)
    expect(route.steps[0]?.instruction).toContain('无需再规划路线')
  })
})
