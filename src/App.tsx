import './App.css'

import { Route, Routes } from 'react-router-dom'

import { HomePage } from './routes/HomePage'
import { PlaceDetailPage } from './routes/PlaceDetailPage'

function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/place/:placeId" element={<PlaceDetailPage />} />
    </Routes>
  )
}

export default App
