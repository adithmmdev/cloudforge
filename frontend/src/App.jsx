import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import AWSSetup from './pages/AWSSetup';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/setup" element={<AWSSetup />} />
        <Route path="*" element={<Navigate to="/setup" replace />} />
      </Routes>
    </Router>
  );
}

export default App;
