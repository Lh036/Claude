import { Routes, Route } from "react-router-dom";
import { AppShell } from "@/components/layout/AppShell";
import OverviewPage from "@/pages/OverviewPage";
import BusinessesPage from "@/pages/BusinessesPage";
import BusinessDetailPage from "@/pages/BusinessDetailPage";
import ScansPage from "@/pages/ScansPage";
import ScanDetailPage from "@/pages/ScanDetailPage";
import RunsPage from "@/pages/RunsPage";
import RunDetailPage from "@/pages/RunDetailPage";
import ActivityPage from "@/pages/ActivityPage";
import LogsPage from "@/pages/LogsPage";
import ErrorsPage from "@/pages/ErrorsPage";
import SettingsPage from "@/pages/SettingsPage";
import NotFoundPage from "@/pages/NotFoundPage";

export default function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route path="/" element={<OverviewPage />} />
        <Route path="/businesses" element={<BusinessesPage />} />
        <Route path="/businesses/:id" element={<BusinessDetailPage />} />
        <Route path="/scans" element={<ScansPage />} />
        <Route path="/scans/:id" element={<ScanDetailPage />} />
        <Route path="/runs" element={<RunsPage />} />
        <Route path="/runs/:id" element={<RunDetailPage />} />
        <Route path="/activity" element={<ActivityPage />} />
        <Route path="/logs" element={<LogsPage />} />
        <Route path="/errors" element={<ErrorsPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
