export async function send(data: {
  voice: Blob;
  image: Blob | null;
  gps: { lat: number; lon: number };
}): Promise<string> {
  const formData = new FormData();
  formData.append(
    "voice",
    data.voice,
    data.voice.type === "audio/wav" ? "voice.wav" : "voice.webm"
  );
  if (data.image) {
    formData.append("image", data.image, "image.png");
  }
  formData.append("lat", String(data.gps.lat));
  formData.append("lon", String(data.gps.lon));

  const response = await fetch("/api/report", {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    return `HTTP error! status: ${response.status}`;
  }

  return await response.text();
}
