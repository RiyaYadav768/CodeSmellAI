import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { MetricsProvider } from './hooks/MetricsContext.jsx'
import LandingPage     from './pages/LandingPage.jsx'
import ResultsViewer   from './pages/ResultsViewer.jsx'
import DependencyGraph from './pages/DependencyGraph.jsx'
import UploadStats     from './pages/UploadStats.jsx'
import FilesExplorer   from './pages/FilesExplorer.jsx'
import Methodology     from './pages/Methodology.jsx'

export default function App() {
  return (
    <MetricsProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/"            element={<LandingPage />}     />
          <Route path="/results"     element={<ResultsViewer />}   />
          <Route path="/graph"       element={<DependencyGraph />} />
          <Route path="/upload"      element={<UploadStats />}     />
          <Route path="/files"       element={<FilesExplorer />}   />
          <Route path="/methodology" element={<Methodology />}     />
          <Route path="*"            element={<NotFound />}        />
        </Routes>
      </BrowserRouter>
    </MetricsProvider>
  )
}

function NotFound() {
  return (
    <div className="min-h-screen bg-bg-base flex flex-col items-center justify-center gap-space-md">
      <span className="text-5xl font-sora font-bold text-primary">404</span>
      <p className="font-inter text-body-default text-text-muted">Page not found.</p>
      <a href="/" className="font-jetbrains text-label-code text-secondary hover:text-primary transition-colors">
        &larr; Back to home
      </a>
    </div>
  )
}