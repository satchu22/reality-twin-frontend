export type UploadResponse = {
  message: string;
};

export async function uploadCsv(file: File): Promise<UploadResponse> {
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch("/data/upload", {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    let errorMessage = "Upload failed";

    try {
      const errorPayload = (await response.json()) as { detail?: string };
      if (typeof errorPayload.detail === "string") {
        errorMessage = errorPayload.detail;
      }
    } catch {
      errorMessage = `Upload failed with status ${response.status}`;
    }

    throw new Error(errorMessage);
  }

  return response.json();
}
