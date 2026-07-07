import { afterEach, describe, expect, it, vi } from 'vitest'

import { requestRoutePlan } from './api'

afterEach(() => {
  vi.restoreAllMocks()
})

describe('requestRoutePlan', () => {
  it('falls back to the local route planner when the API is unavailable', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: false,
      status: 404,
      json: async () => ({ message: 'Not found' }),
    } as Response)

    const route = await requestRoutePlan({
      startPlaceId: 'west-gate',
      endPlaceId: 'library-information-center',
    })

    expect(route.distanceMeters).toBeGreaterThan(0)
    expect(route.steps[0]?.instruction).toContain('西门')
  })
})
