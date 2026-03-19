// ── Collection SVG Generation ────────────────────────────────

export function generateCollectionSVG(thumbnailUrls, collectionName = '') {
  // Limit to first 4 thumbnails for a 2x2 grid
  const urls = thumbnailUrls.slice(0, 4);

  // If no thumbnails, use a simple pattern with collection initial
  if (urls.length === 0) {
    const initial = collectionName.charAt(0).toUpperCase() || '?';
    return generatePlaceholderSVG(initial);
  }

  // Create 2x2 grid layout
  const svgWidth = 320;
  const svgHeight = 180;
  const cellWidth = svgWidth / 2;
  const cellHeight = svgHeight / 2;

  let cells = '';

  urls.forEach((url, index) => {
    const x = (index % 2) * cellWidth;
    const y = Math.floor(index / 2) * cellHeight;

    // Embed thumbnail as image
    cells += `
      <image
        href="${url}"
        x="${x}"
        y="${y}"
        width="${cellWidth}"
        height="${cellHeight}"
        preserveAspectRatio="cover"
      />`;
  });

  // Fill remaining cells with gray background
  for (let i = urls.length; i < 4; i++) {
    const x = (i % 2) * cellWidth;
    const y = Math.floor(i / 2) * cellHeight;

    cells += `
      <rect
        x="${x}"
        y="${y}"
        width="${cellWidth}"
        height="${cellHeight}"
        fill="#1a1a2e"
      />`;
  }

  // Add border and optional collection icon overlay
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${svgWidth}" height="${svgHeight}" viewBox="0 0 ${svgWidth} ${svgHeight}">
      <defs>
        <rect id="bg" width="${svgWidth}" height="${svgHeight}" fill="#0f0f1a"/>
        <clipPath id="rounded-corners">
          <rect width="${svgWidth}" height="${svgHeight}" rx="6" ry="6"/>
        </clipPath>
      </defs>

      <!-- Background -->
      <use href="#bg" clip-path="url(#rounded-corners)"/>

      <!-- Image cells -->
      ${cells}

      <!-- Border -->
      <rect
        width="${svgWidth}"
        height="${svgHeight}"
        fill="none"
        stroke="#333"
        stroke-width="1"
        rx="6"
        ry="6"
      />

      <!-- Collection icon badge in top right -->
      <circle
        cx="${svgWidth - 15}"
        cy="15"
        r="10"
        fill="rgba(103, 232, 249, 0.9)"
        stroke="rgba(255,255,255,0.8)"
        stroke-width="1"
      />
      <text
        x="${svgWidth - 15}"
        y="15"
        text-anchor="middle"
        dominant-baseline="central"
        fill="#040714"
        font-size="10"
        font-weight="bold"
      >C</text>
    </svg>
  `;

  // Return as data URL
  return 'data:image/svg+xml;base64,' + btoa(svg);
}

function generatePlaceholderSVG(initial) {
  const svgWidth = 320;
  const svgHeight = 180;

  // Generate a simple pattern based on the initial
  const hue = (initial.charCodeAt(0) * 137.5) % 360; // Golden angle approximation

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${svgWidth}" height="${svgHeight}" viewBox="0 0 ${svgWidth} ${svgHeight}">
      <defs>
        <rect width="${svgWidth}" height="${svgHeight}" fill="hsl(${hue}, 30%, 15%)"/>
        <clipPath id="rounded-corners">
          <rect width="${svgWidth}" height="${svgHeight}" rx="6" ry="6"/>
        </clipPath>
      </defs>

      <!-- Background with pattern -->
      <rect width="${svgWidth}" height="${svgHeight}" fill="hsl(${hue}, 30%, 15%)" clip-path="url(#rounded-corners)"/>

      <!-- Pattern circles -->
      <circle cx="${svgWidth/2}" cy="${svgHeight/2}" r="40" fill="hsl(${hue}, 50%, 25%)" opacity="0.5"/>
      <circle cx="${svgWidth * 0.3}" cy="${svgHeight * 0.3}" r="20" fill="hsl(${hue}, 60%, 35%)" opacity="0.3"/>
      <circle cx="${svgWidth * 0.7}" cy="${svgHeight * 0.7}" r="25" fill="hsl(${hue}, 60%, 35%)" opacity="0.3"/>

      <!-- Initial text -->
      <text
        x="${svgWidth/2}"
        y="${svgHeight/2}"
        text-anchor="middle"
        dominant-baseline="central"
        fill="hsl(${hue}, 70%, 80%)"
        font-size="48"
        font-weight="bold"
        font-family="Arial, sans-serif"
      >${initial}</text>

      <!-- Border -->
      <rect
        width="${svgWidth}"
        height="${svgHeight}"
        fill="none"
        stroke="#333"
        stroke-width="1"
        rx="6"
        ry="6"
      />
    </svg>
  `;

  return 'data:image/svg+xml;base64,' + btoa(svg);
}

export async function generateCollectionImageFromChannels(channelIds) {
  // If no channel IDs, return placeholder
  if (!channelIds || channelIds.length === 0) {
    return generatePlaceholderSVG('?');
  }

  // This function would be called with actual channel IDs
  // In practice, we'd need to fetch the thumbnail URLs from the channels
  // For now, return a placeholder that can be replaced later
  return generatePlaceholderSVG('C');
}
