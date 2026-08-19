import { Routes, Route, Navigate } from 'react-router-dom'
import { Library } from './pages/Library'
import { Reader } from './pages/Reader'
import { Vocabulary } from './pages/Vocabulary'
import { Settings } from './pages/Settings'
import { Layout } from './components/Layout'

export function App() {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<Navigate to="/library" replace />} />
        <Route path="library" element={<Library />} />
        <Route path="read/:bookId" element={<Reader />} />
        <Route path="vocabulary" element={<Vocabulary />} />
        <Route path="settings" element={<Settings />} />
      </Route>
    </Routes>
  )
}

export default App
