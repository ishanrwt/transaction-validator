import { useState } from "react";
import ValidatorPage from "./pages/ValidatorPage";
import SettingsPage from "./pages/SettingsPage";

function App() {
  // The app is small enough that simple local page state is clearer than a router.
  const [page, setPage] = useState("validator");

  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-200 bg-white shadow-sm">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <h1 className="text-lg font-semibold text-slate-800">
            Transaction Data Validation
          </h1>
          <nav className="flex gap-2">
            <button
              type="button"
              onClick={() => setPage("validator")}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
                page === "validator"
                  ? "bg-blue-600 text-white"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              Validator
            </button>
            <button
              type="button"
              onClick={() => setPage("settings")}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
                page === "settings"
                  ? "bg-blue-600 text-white"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              Settings
            </button>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8">
        {page === "validator" ? <ValidatorPage /> : <SettingsPage />}
      </main>
    </div>
  );
}

export default App;
