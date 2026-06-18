import { useEffect, useState } from "react";
import axios from "axios";
import DropZone from "../components/DropZone";
import SummaryCards from "../components/SummaryCards";
import ResultsTable from "../components/ResultsTable";
import DownloadSection from "../components/DownloadSection";

const API_URL = import.meta.env.REACT_APP_API_URL || "http://localhost:5000";

const SAMPLE_CSV = [
  "order_id,customer_name,phone_number,country_code,email,order_date,order_time,order_status,currency,product_id,product_name,category,quantity,unit_price,discount,line_total,payment_mode,transaction_id,amount_paid,payment_status,payment_date",
  "O001,Aarav Sharma,9876543210,IN,aarav@example.com,15-06-2024,10:30,CONFIRMED,INR,P001,Wireless Mouse,Electronics,2,500,10,900,UPI,TXN001,900,SUCCESS,15-06-2024",
  "O002,Meera Nair,81234567,SG,meera@example.com,2024-06-16,14:00,CONFIRMED,SGD,P002,Notebook,Stationery,3,12,0,36,CARD,TXN002,36,SUCCESS,2024-06-16",
].join("\n");

function downloadSampleCsv() {
  const blob = new Blob([SAMPLE_CSV], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = "transaction_sample.csv";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export default function ValidatorPage() {
  // The validator is a simple state machine: upload -> loading -> results/error.
  const [step, setStep] = useState("upload");
  const [file, setFile] = useState(null);
  const [result, setResult] = useState(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [showBackendWakeMessage, setShowBackendWakeMessage] = useState(false);

  useEffect(() => {
    if (step !== "loading") {
      setShowBackendWakeMessage(false);
      return undefined;
    }

    // Render free-tier services can sleep; show a helpful note only after a delay.
    const timer = setTimeout(() => {
      setShowBackendWakeMessage(true);
    }, 10000);

    return () => clearTimeout(timer);
  }, [step]);

  const reset = () => {
    setStep("upload");
    setFile(null);
    setResult(null);
    setErrorMessage("");
    setShowBackendWakeMessage(false);
  };

  const handleValidate = async () => {
    if (!file) return;

    setStep("loading");
    setErrorMessage("");
    setShowBackendWakeMessage(false);

    const formData = new FormData();
    // Backend upload middleware expects the file field to be named "file".
    formData.append("file", file);

    try {
      const response = await axios.post(`${API_URL}/api/validate`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      setResult(response.data);
      setStep("results");
    } catch (error) {
      const data = error.response?.data;
      // Structural validation errors return "reason"; unexpected errors return "error".
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
        {showBackendWakeMessage && (
          <p className="mt-2 max-w-md text-center text-sm text-amber-700">
            Waiting for the backend to start. This can take a little longer on
            the first request. Please wait...
          </p>
        )}
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
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-slate-800">Upload CSV</h2>
          <p className="mt-1 text-sm text-slate-500">
            Upload a transaction CSV file to validate and clean your data.
          </p>
        </div>
        <button
          type="button"
          onClick={downloadSampleCsv}
          className="w-fit rounded-lg border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-medium text-blue-700 transition hover:bg-blue-100"
        >
          Download Sample CSV
        </button>
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
