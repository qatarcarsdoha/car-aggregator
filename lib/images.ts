// Transform a stored full-size image URL into a feed-sized thumbnail URL.
// QL exposes pre-generated 432x300 thumbnails on its CDN; QS (Google Cloud
// Storage) has no thumbnail variant, so QS URLs pass through unchanged.
export function toFeedThumbnail(url: string): string {
  if (!url.includes("qlv-media-prod.qatarliving.com")) return url;

  const lastSlash = url.lastIndexOf("/");
  if (lastSlash === -1) return url;

  const dir = url.slice(0, lastSlash);
  const file = url.slice(lastSlash + 1);
  if (dir.endsWith("/thumbnail")) return url;

  const dot = file.lastIndexOf(".");
  const base = dot === -1 ? file : file.slice(0, dot);
  return `${dir}/thumbnail/${base}_432x300.webp`;
}
