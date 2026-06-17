function downloadBase64Csv(base64Data, filename) {
  const binary = atob(base64Data);
  const bytes = new Uint8Array(binary.length);

  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }

  const blob = new Blob([bytes], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export default function DownloadSection({ cleanedChunks, errorsFile }) {
  const hasCleanedChunks =
    cleanedChunks && cleanedChunks.some((chunk) => chunk.data);

  const hasErrors = errorsFile && errorsFile.data;

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <h3 className="mb-4 text-lg font-semibold text-slate-800">Downloads</h3>

      <div className="space-y-4">
        <div>
          <p className="mb-2 text-sm font-medium text-slate-600">Cleaned data</p>
          {hasCleanedChunks ? (
            <div className="flex flex-wrap gap-2">
              {cleanedChunks.map((chunk, index) => (
                <button
                  key={chunk.filename}
                  type="button"
                  onClick={() => downloadBase64Csv(chunk.data, chunk.filename)}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700"
                >
                  Download Part {index + 1} (CSV)
                </button>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-500">No cleaned rows</p>
          )}
        </div>

        <div>
          <p className="mb-2 text-sm font-medium text-slate-600">Error report</p>
          {hasErrors ? (
            <button
              type="button"
              onClick={() =>
                downloadBase64Csv(errorsFile.data, errorsFile.filename)
              }
              className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-red-700"
            >
              Download Error Report (CSV)
            </button>
          ) : (
            <p className="text-sm text-slate-500">No errors found</p>
          )}
        </div>
      </div>
    </div>
  );
}
