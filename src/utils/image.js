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
