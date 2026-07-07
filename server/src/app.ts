import cors from 'cors'
import express from 'express'
import path from 'node:path'

import type { RoutePlanRequest } from '../../shared/navigation.js'
import { bootstrapPayload, graphEdges, graphNodes, places } from './data/navigation-seed.js'
import { RoutePlanner } from './services/route-planner.js'

const projectRoot = process.cwd()
const clientDistDir = path.resolve(projectRoot, 'dist')

const routePlanner = new RoutePlanner(graphNodes, graphEdges, places)

export function createApp() {
  const app = express()

  app.use(cors())
  app.use(express.json())

  app.get('/api/health', (_request, response) => {
    response.json({ ok: true })
  })

  app.get('/api/navigation/bootstrap', (_request, response) => {
    response.json(bootstrapPayload)
  })

  app.post('/api/navigation/route', (request, response) => {
    const body = request.body as Partial<RoutePlanRequest>

    if (!body.startPlaceId || !body.endPlaceId) {
      response.status(400).json({ message: '必须提供起点和终点。' })
      return
    }

    try {
      const route = routePlanner.planRoute(body.startPlaceId, body.endPlaceId)
      response.json(route)
    } catch (error) {
      response.status(400).json({
        message: error instanceof Error ? error.message : '路线规划失败。',
      })
    }
  })

  app.use(express.static(clientDistDir))

  app.get(/^(?!\/api).*/, (_request, response) => {
    response.sendFile(path.resolve(clientDistDir, 'index.html'))
  })

  return app
}
