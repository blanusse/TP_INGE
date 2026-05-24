import { BASE_URL, getToken } from "../api";

export async function uploadDocumentImage(imageUri: string, endpoint: string) {
  const token = getToken();
  const formData = new FormData();

  const filename = imageUri.split("/").pop() ?? "photo.jpg";
  const match = /\.(\w+)$/.exec(filename);
  const type = match ? `image/${match[1]}` : "image/jpeg";

  formData.append("file", {
    uri: imageUri,
    name: filename,
    type,
  } as unknown as Blob);

  const res = await fetch(`${BASE_URL}${endpoint}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: formData,
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.message ?? data.error ?? "Error al subir documento.");
  return data;
}
