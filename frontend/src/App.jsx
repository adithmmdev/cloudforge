import React from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import AWSSetup from './pages/AWSSetup'
import Dashboard from './pages/Dashboard'
import Upload from './pages/Upload'
import ProjectDetail from './pages/ProjectDetail'
import Settings from './pages/Settings'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/setup" element={<AWSSetup />} />
        <Route path="/upload" element={<Upload />} />
        <Route path="/project/:id" element={<ProjectDetail />} />
        <Route path="/settings" element={<Settings />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App;
