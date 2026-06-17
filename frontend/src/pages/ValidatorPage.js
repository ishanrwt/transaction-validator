import { useState } from "react";
import axios from "axios";
import DropZone from "../components/DropZone";
import SummaryCards from "../components/SummaryCards";
import ResultsTable from "../components/ResultsTable";
import DownloadSection from "../components/DownloadSection";

const API_URL = import.meta.env.REACT_APP_API_URL || "http://localhost:5000";

export default function ValidatorPage() {
  const [step, setStep] = useState("upload");
  const [file, setFile] = useState(null);
  const [result, setResult] = useState(null);
  const [errorMessage, setErrorMessage] = useState("");

  const reset = () => {
    setStep("upload");
    setFile(null);
    setResult(null);
    setErrorMessage("");
  };

  const handleValidate = async () => {
    if (!file) return;

    setStep("loading");
    setErrorMessage("");

    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await axios.post(`${API_URL}/api/validate`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      setResult(response.data);
      setStep("results");
    } catch (error) {
      const data = error.response?.data;
      const message =
        data?.reason ||
        data?.error ||
        data?.message ||
        error.message ||
        "Validation failed";

      setErrorMessage(message);
      setStep("error");
    }
  };

  if (step === "loading") {
    return (
      <div className="flex flex-col items-center justify-center py-24">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-blue-200 border-t-blue-600" />
        <p className="mt-4 text-slate-600">Running validation pipeline...</p>
      </div>
    );
  }

  if (step === "error") {
    return (
      <div className="space-y-4">
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-4 text-red-800">
          <p className="font-semibold">Validation failed</p>
          <p className="mt-1 text-sm">{errorMessage}</p>
        </div>
        <button
          type="button"
          onClick={reset}
          className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-medium text-white hover:bg-slate-900"
        >
          Try again
        </button>
      </div>
    );
  }

  if (step === "results" && result) {
    return (
      <div className="space-y-6">
        <SummaryCards summary={result.summary} />
        <div>
          <h2 className="mb-3 text-lg font-semibold text-slate-800">Row results</h2>
          <ResultsTable rowResults={result.row_results} />
        </div>
        <DownloadSection
          cleanedChunks={result.cleaned_chunks}
          errorsFile={result.errors_file}
        />
        <button
          type="button"
          onClick={reset}
          className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          Validate another file
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-slate-800">Upload CSV</h2>
        <p className="mt-1 text-sm text-slate-500">
          Upload a transaction CSV file to validate and clean your data.
        </p>
      </div>

      <DropZone file={file} onFileSelect={setFile} />

      <div className="flex gap-3">
        <button
          type="button"
          onClick={handleValidate}
          disabled={!file}
          className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Validate
        </button>
        <button
          type="button"
          onClick={reset}
          className="rounded-lg border border-slate-300 bg-white px-5 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          Clear
        </button>
      </div>
    </div>
  );
}
