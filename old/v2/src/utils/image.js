export function isImageUrl(url) {
  return /\.(jpeg|jpg|png|gif)/i.test(url);
}

export function loadImageElement(src, { crossOrigin = null } = {}) {
  return new Promise((resolve, reject) => {
    const image = new Image();

    if (crossOrigin) {
      image.crossOrigin = crossOrigin;
    }

    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Failed to load image: ${src}`));
    image.src = src;
  });
}

export async function loadImageElementFromSources(sources, { crossOrigin = null } = {}) {
  const uniqueSources = [...new Set((sources ?? []).filter(Boolean))];
  const errors = [];

  for (const source of uniqueSources) {
    try {
      const image = await loadImageElement(source, { crossOrigin });
      return {
        image,
        src: source,
      };
    } catch (error) {
      errors.push(error?.message || `Failed to load image: ${source}`);
    }
  }

  throw new Error(errors.join(' | ') || 'Failed to load image.');
}
