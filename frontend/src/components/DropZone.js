import { useCallback } from "react";
import { useDropzone } from "react-dropzone";

function formatFileSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function DropZone({ file, onFileSelect }) {
  const onDrop = useCallback(
    (acceptedFiles) => {
      if (acceptedFiles.length > 0) {
        onFileSelect(acceptedFiles[0]);
      }
    },
    [onFileSelect]
  );

  const { getRootProps, getInputProps, isDragActive, fileRejections } =
    useDropzone({
      onDrop,
      accept: { "text/csv": [".csv"] },
      maxFiles: 1,
      multiple: false,
    });

  const rejection = fileRejections[0]?.errors[0]?.message;

  return (
    <div className="space-y-3">
      <div
        {...getRootProps()}
        className={`cursor-pointer rounded-xl border-2 border-dashed px-6 py-12 text-center transition ${
          isDragActive
            ? "border-blue-500 bg-blue-50"
            : "border-slate-300 bg-white hover:border-blue-400 hover:bg-slate-50"
        }`}
      >
        <input {...getInputProps()} />
        <p className="text-base font-medium text-slate-700">
          {isDragActive
            ? "Drop the CSV file here..."
            : "Drag & drop a CSV file here, or click to browse"}
        </p>
        <p className="mt-2 text-sm text-slate-500">Only .csv files are accepted</p>
      </div>

      {rejection && (
        <p className="text-sm text-red-600">{rejection}</p>
      )}

      {file && (
        <div className="rounded-lg border border-slate-200 bg-white px-4 py-3">
          <p className="text-sm font-medium text-slate-800">{file.name}</p>
          <p className="text-sm text-slate-500">{formatFileSize(file.size)}</p>
        </div>
      )}
    </div>
  );
}
