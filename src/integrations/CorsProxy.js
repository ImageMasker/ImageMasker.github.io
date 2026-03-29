export function addProxyToUrl(baseUrl) {
  return 'https://cors.bridged.cc/' + baseUrl.replace(/(^\w+:|^)\/\//, '');
}

export const IMGUR_UPLOAD_PROXY_CANDIDATES = [
  {
    id: 'cors-anywhere',
    label: 'CORS Anywhere',
    buildUrl: (targetUrl) => `https://cors-anywhere.com/${targetUrl}`,
  },
  {
    id: 'cloudflare-cors-anywhere',
    label: 'Cloudflare CORS Anywhere demo',
    buildUrl: (targetUrl) => `https://test.cors.workers.dev/?${targetUrl}`,
  },
];
