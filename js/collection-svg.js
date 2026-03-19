// ── Collection Image Generation ────────────────────────────────

export function generateCollectionSVG(thumbnailUrls, collectionName = '') {
  // Use the first channel's thumbnail as the collection cover
  if (thumbnailUrls && thumbnailUrls.length > 0 && thumbnailUrls[0]) {
    return thumbnailUrls[0];
  }
  // No thumbnails available — return empty (no image)
  return '';
}
