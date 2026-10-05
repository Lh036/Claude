import { Route, Routes } from "react-router-dom";
import { Layout } from "./components/Layout";
import DashboardPage from "./pages/DashboardPage";
import ExpensesPage from "./pages/ExpensesPage";
import CategoriesPage from "./pages/CategoriesPage";
import VatCalculatorPage from "./pages/VatCalculatorPage";
import { EmptyState } from "./components/ui";

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/kosten" element={<ExpensesPage />} />
        <Route path="/categorieen" element={<CategoriesPage />} />
        <Route path="/btw" element={<VatCalculatorPage />} />
        <Route path="*" element={<EmptyState title="Pagina niet gevonden" description="Deze pagina bestaat niet." />} />
      </Route>
    </Routes>
  );
}
