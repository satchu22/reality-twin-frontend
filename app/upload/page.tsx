"use client";
import { useState } from "react";

export default function UploadPage() {
  const [file, setFile] = useState<any>(null);

  const handleUpload = async () => {
    const formData = new FormData();
    formData.append("file", file);

    await fetch("http://127.0.0.1:8000/upload", {
      method: "POST",
      body: formData
    });

    alert("File uploaded!");
  };

  return (
    <div className="min-h-screen bg-black text-white p-10">
      <h1 className="text-3xl font-bold mb-6">Upload Data</h1>

      <input
        type="file"
        onChange={(e: any) => setFile(e.target.files[0])}
        className="mb-4"
      />

      <button
        onClick={handleUpload}
        className="px-6 py-3 bg-cyan-400 text-black rounded-xl"
      >
        Upload CSV
      </button>
    </div>
  );
}