const DEV_ASSERTS_KEY = 'imagemasker.dev.asserts';

function readDevAssertFlag() {
  try {
    if (window.__IMAGEMASKER_DEV_ASSERTS__ === true) {
      return true;
    }

    const url = new URL(window.location.href);
    if (url.searchParams.get('devAsserts') === '1') {
      return true;
    }

    return localStorage.getItem(DEV_ASSERTS_KEY) === '1';
  } catch {
    return false;
  }
}

export function devAssert(condition, message, details = null) {
  if (condition) {
    return true;
  }

  const error = new Error(message);
  error.name = 'ImageMaskerDevAssertionError';

  if (details) {
    console.warn(`[ImageMasker assertion] ${message}`, details);
  } else {
    console.warn(`[ImageMasker assertion] ${message}`);
  }

  if (readDevAssertFlag()) {
    throw error;
  }

  return false;
}
