import { buildApiUrl } from "@/lib/api";

export async function POST(request: Request) {
  const formData = await request.formData();

  const response = await fetch(buildApiUrl("/upload"), {
    method: "POST",
    body: formData as unknown as BodyInit,
  });

  const body = await response.text();

  return new Response(body, {
    status: response.status,
    headers: {
      "content-type": response.headers.get("content-type") ?? "application/json",
    },
  });
}
