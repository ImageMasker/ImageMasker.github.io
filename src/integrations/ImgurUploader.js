import { IMGUR_UPLOAD_PROXY_CANDIDATES } from './CorsProxy.js';

export class ImgurUploader {
  constructor(canvasEngine, settings) {
    this.canvasEngine = canvasEngine;
    this.settings = settings;
  }

  async upload(dataUrl) {
    const { blob, mimeType } = this.dataUrlToBlob(dataUrl);
    const fileName = `imagemasker-upload.${this.getFileExtension(mimeType)}`;
    const authHeader = this.getAuthorizationHeader();
    const uploadUrl = 'https://api.imgur.com/3/image';
    const allowProxyFallback = !this.hasUserAccessToken();
    const attempts = [
      {
        label: 'Imgur',
        url: uploadUrl,
      },
      ...(allowProxyFallback
        ? IMGUR_UPLOAD_PROXY_CANDIDATES.map((proxy) => ({
          label: proxy.label,
          url: proxy.buildUrl(uploadUrl),
        }))
        : []),
    ];
    const errors = [];

    for (const attempt of attempts) {
      try {
        const response = await fetch(attempt.url, {
          method: 'POST',
          headers: {
            Accept: 'application/json',
            Authorization: authHeader,
          },
          body: this.buildFormData(blob, fileName),
        });
        const data = await this.parseResponse(response);

        if (response.ok && data?.success && data?.data?.link) {
          return { success: true, url: data.data.link };
        }

        throw new Error(this.getErrorMessage(data, response));
      } catch (error) {
        errors.push(`${attempt.label}: ${error.message}`);
      }
    }

    if (!allowProxyFallback) {
      throw new Error(
        `${errors[0] || 'Direct upload failed.'} Proxy fallback was skipped because a public CORS proxy would receive your Imgur access token.`
      );
    }

    throw new Error(errors.join(' | ') || 'Upload failed');
  }

  getAuthorizationHeader() {
    const token = this.settings.getAccessToken().trim();

    if (!token) {
      return 'Client-ID 9c586fafe6ec100';
    }

    return /^(Bearer|Client-ID)\s/i.test(token) ? token : `Bearer ${token}`;
  }

  hasUserAccessToken() {
    const token = this.settings.getAccessToken().trim();

    if (!token) {
      return false;
    }

    return !/^Client-ID\s/i.test(token);
  }

  buildFormData(blob, fileName) {
    const formData = new FormData();
    formData.append('image', blob, fileName);
    return formData;
  }

  dataUrlToBlob(dataUrl) {
    const [meta, base64 = ''] = String(dataUrl).split(',', 2);
    const mimeType = /^data:([^;]+);base64$/i.exec(meta)?.[1] || 'image/png';
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);

    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }

    return {
      blob: new Blob([bytes], { type: mimeType }),
      mimeType,
    };
  }

  getFileExtension(mimeType) {
    if (mimeType === 'image/jpeg') {
      return 'jpg';
    }

    if (mimeType === 'image/gif') {
      return 'gif';
    }

    if (mimeType === 'image/webp') {
      return 'webp';
    }

    return 'png';
  }

  async parseResponse(response) {
    const contentType = response.headers.get('content-type') || '';

    if (contentType.includes('application/json')) {
      return response.json();
    }

    const text = await response.text();

    try {
      return JSON.parse(text);
    } catch {
      return {
        success: false,
        data: {
          error: text || `Upload failed (${response.status})`,
        },
      };
    }
  }

  getErrorMessage(data, response) {
    const apiError = data?.data?.error;

    if (typeof apiError === 'string' && apiError.trim()) {
      return apiError;
    }

    if (Array.isArray(apiError) && apiError.length) {
      return apiError.join(', ');
    }

    if (apiError && typeof apiError === 'object') {
      return Object.values(apiError)
        .flat()
        .filter(Boolean)
        .join(', ') || `Upload failed (${response.status})`;
    }

    if (!response.ok) {
      return `Upload failed (${response.status} ${response.statusText})`;
    }

    return 'Upload failed';
  }
}
