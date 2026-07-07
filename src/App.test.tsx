import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'

import App from './App'

function renderRoute(initialEntry = '/') {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <App />
    </MemoryRouter>,
  )
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('campus navigation app', () => {
  it('renders the homepage and filters places by category', async () => {
    const user = userEvent.setup()

    renderRoute('/')

    expect(
      screen.getByRole('heading', { level: 1, name: '山科智行 Campus Pulse' }),
    ).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /图书馆/ }))

    expect(
      screen.getByRole('button', { name: '图书信息中心 点位' }),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: '体育运动场 点位' }),
    ).not.toBeInTheDocument()
  })

  it('opens preview from a marker and keeps list/map selection in sync', async () => {
    const user = userEvent.setup()

    renderRoute('/')

    await user.click(screen.getByRole('button', { name: '图书信息中心 点位' }))

    expect(screen.getByLabelText('已选地点详情')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '预览 图书信息中心' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
  })

  it('navigates to a place detail page from the homepage preview', async () => {
    const user = userEvent.setup()

    renderRoute('/')

    await user.click(screen.getByRole('button', { name: '图书信息中心 点位' }))
    await user.click(screen.getByRole('link', { name: '进入详情页' }))

    expect(screen.getByRole('heading', { name: '图书信息中心' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: '返回地图首页' })).toBeInTheDocument()
  })

  it('supports direct route access and invalid place fallback', () => {
    renderRoute('/place/library-information-center')

    expect(screen.getByRole('heading', { name: '图书信息中心' })).toBeInTheDocument()
  })

  it('shows a friendly fallback for an unknown place id', () => {
    renderRoute('/place/not-found')

    expect(screen.getByRole('heading', { name: '未找到该地点' })).toBeInTheDocument()
  })

  it('plans a route after selecting a start and an end place', async () => {
    const user = userEvent.setup()
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        startPlaceId: 'west-gate',
        endPlaceId: 'library-information-center',
        distanceMeters: 580,
        estimatedMinutes: 8,
        pathPoints: [
          { xPct: 11, yPct: 55 },
          { xPct: 18, yPct: 51 },
          { xPct: 23, yPct: 49 },
          { xPct: 36, yPct: 46 },
          { xPct: 48, yPct: 34 },
        ],
        steps: [
          {
            edgeId: 'edge-west-gate-plaza',
            fromLabel: '西门入口',
            toLabel: '西部门户广场',
            instruction: '从西门进入校园，沿门户通道步行至西部门户广场。',
            distanceMeters: 110,
          },
        ],
      }),
    } as Response)

    renderRoute('/')

    await user.selectOptions(screen.getByLabelText('起点'), 'west-gate')
    await user.selectOptions(screen.getByLabelText('终点'), 'library-information-center')

    expect(await screen.findByText('总距离')).toBeInTheDocument()
    expect(screen.getByText('580 米')).toBeInTheDocument()
    expect(fetchSpy).toHaveBeenCalledWith(
      '/api/navigation/route',
      expect.objectContaining({
        method: 'POST',
      }),
    )
  })

  it('allows switching back to route schematic after a route is selected', async () => {
    const user = userEvent.setup()
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        startPlaceId: 'west-gate',
        endPlaceId: 'library-information-center',
        distanceMeters: 580,
        estimatedMinutes: 8,
        pathPoints: [
          { xPct: 11, yPct: 55 },
          { xPct: 18, yPct: 51 },
          { xPct: 23, yPct: 49 },
          { xPct: 36, yPct: 46 },
          { xPct: 48, yPct: 34 },
        ],
        steps: [
          {
            edgeId: 'edge-west-gate-plaza',
            fromLabel: '西门入口',
            toLabel: '西部门户广场',
            instruction: '从西门进入校园，沿门户通道步行至西部门户广场。',
            distanceMeters: 110,
          },
        ],
      }),
    } as Response)

    renderRoute('/')

    await user.selectOptions(screen.getByLabelText('起点'), 'west-gate')
    await user.selectOptions(screen.getByLabelText('终点'), 'library-information-center')

    await user.click(screen.getByRole('tab', { name: '实景地图' }))
    expect(await screen.findByLabelText('实景地图')).toBeInTheDocument()

    await user.click(screen.getByRole('tab', { name: '校园拓扑' }))
    expect(screen.getByAltText('山科智行校园拓扑底图')).toBeInTheDocument()
  })
})
