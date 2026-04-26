"use client";

import { useState } from "react";

import { uploadCsv } from "@/lib/upload";

type UploadComponentProps = {
  onUploadSuccess?: () => void;
};

export default function UploadComponent({
  onUploadSuccess,
}: UploadComponentProps) {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleUpload() {
    if (!file) {
      setError("Choose a CSV file before uploading.");
      setMessage(null);
      return;
    }

    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      const result = await uploadCsv(file);
      setMessage(result.message || "Upload completed successfully.");
      onUploadSuccess?.();
    } catch (uploadError) {
      setError(
        uploadError instanceof Error ? uploadError.message : "Upload failed",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="rounded-3xl border border-white/10 bg-white/5 p-8 shadow-2xl backdrop-blur">
      <div className="mb-6">
        <h2 className="text-2xl font-semibold text-white">Upload CSV</h2>
        <p className="mt-2 text-sm text-slate-400">
          Send shipment data to the backend upload workflow.
        </p>
      </div>

      <div className="space-y-4">
        <input
          type="file"
          accept=".csv,text/csv"
          onChange={(event) => setFile(event.target.files?.[0] ?? null)}
          className="w-full rounded-xl border border-white/10 bg-slate-900 p-3 text-sm text-slate-200"
        />

        {message && (
          <p className="rounded-2xl border border-emerald-400/20 bg-emerald-400/10 p-4 text-sm text-emerald-200">
            {message}
          </p>
        )}

        {error && (
          <p className="rounded-2xl border border-red-400/20 bg-red-400/10 p-4 text-sm text-red-200">
            {error}
          </p>
        )}

        <button
          type="button"
          onClick={handleUpload}
          disabled={loading}
          className="flex w-full items-center justify-center gap-3 rounded-xl bg-cyan-400 px-6 py-3 font-semibold text-slate-950 transition hover:bg-cyan-300 disabled:opacity-60"
        >
          {loading && (
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-950/40 border-t-slate-950" />
          )}
          <span>{loading ? "Uploading..." : "Upload CSV"}</span>
        </button>
      </div>
    </section>
  );
}
