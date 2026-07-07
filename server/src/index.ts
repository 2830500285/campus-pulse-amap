import { createApp } from './app.js'

const port = Number.parseInt(process.env.PORT ?? '8787', 10)
const app = createApp()

app.listen(port, '0.0.0.0', () => {
  console.log(`Campus navigation server listening on http://127.0.0.1:${port}`)
})
