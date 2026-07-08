/**
 * FireGuard AI — Root Application Component
 *
 * Operations Center routing:
 *   /           → MonitoringPage (primary)
 *   /incidents  → IncidentsPage
 *   /analytics  → AnalyticsPage (includes export)
 *   /system     → SettingsPage
 */

import { BrowserRouter, Routes, Route } from 'react-router-dom';
import MainLayout from './components/layout/MainLayout';
import MonitoringPage from './pages/MonitoringPage';
import IncidentsPage from './pages/IncidentsPage';
import AnalyticsPage from './pages/AnalyticsPage';
import SettingsPage from './pages/SettingsPage';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<MainLayout />}>
          <Route path="/" element={<MonitoringPage />} />
          <Route path="/incidents" element={<IncidentsPage />} />
          <Route path="/analytics" element={<AnalyticsPage />} />
          <Route path="/system" element={<SettingsPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
