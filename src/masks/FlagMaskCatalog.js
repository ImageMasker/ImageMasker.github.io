const CONFIG_URL = new URL('./flagMaskConfig.json', import.meta.url);
const FLAG_SOURCE_TYPE = 'generated-flag-mask';

let catalogPromise = null;

function normalizeFlag(flag) {
  const renderMode = flag?.renderMode === 'full' ? 'full' : 'rows';

  return {
    id: String(flag?.id ?? ''),
    name: String(flag?.name ?? ''),
    legacyUrl: String(flag?.legacyUrl ?? ''),
    renderMode,
    source: {
      width: Number(flag?.source?.width ?? 0),
      height: Number(flag?.source?.height ?? 0),
    },
    motif: {
      src: String(flag?.motif?.src ?? ''),
      width: Number(flag?.motif?.width ?? 0),
      height: Number(flag?.motif?.height ?? 0),
      anchorX: Number(flag?.motif?.anchorX ?? 0),
      anchorY: Number(flag?.motif?.anchorY ?? 0),
    },
    pattern: {
      rows: Array.isArray(flag?.pattern?.rows)
        ? flag.pattern.rows.map((row) => ({
            y: Number(row?.y ?? 0),
            centers: Array.isArray(row?.centers)
              ? row.centers.map((value) => Number(value)).filter(Number.isFinite)
              : [],
          }))
        : [],
    },
    full: {
      src: String(flag?.full?.src ?? ''),
      width: Number(flag?.full?.width ?? 0),
      height: Number(flag?.full?.height ?? 0),
    },
  };
}

function createCatalog(config) {
  const flags = Array.isArray(config?.masks)
    ? config.masks.map(normalizeFlag).filter((flag) =>
        flag.id &&
        flag.name &&
        flag.source.width > 0 &&
        flag.source.height > 0 &&
        (
          flag.renderMode === 'full'
            ? flag.full.src
            : flag.motif.src && flag.pattern.rows.length > 0
        )
      )
    : [];
  const byId = new Map(flags.map((flag) => [flag.id, flag]));
  const byLegacyUrl = new Map(flags.map((flag) => [flag.legacyUrl, flag]));

  return {
    flags,
    findById(id) {
      return byId.get(String(id ?? '')) ?? null;
    },
    findByLegacyUrl(url) {
      return byLegacyUrl.get(String(url ?? '')) ?? null;
    },
    resolve(source) {
      if (!source) {
        return null;
      }

      if (typeof source === 'string') {
        return byId.get(source) ?? byLegacyUrl.get(source) ?? null;
      }

      if (source.type === FLAG_SOURCE_TYPE) {
        return byId.get(String(source.id ?? '')) ?? null;
      }

      return byId.get(String(source.id ?? '')) ??
        byLegacyUrl.get(String(source.url ?? source.legacyUrl ?? '')) ??
        null;
    },
  };
}

export function createFlagMaskSource(id) {
  return {
    type: FLAG_SOURCE_TYPE,
    id,
  };
}

export async function loadFlagMaskCatalog() {
  if (!catalogPromise) {
    catalogPromise = fetch(CONFIG_URL)
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Failed to load flag mask config: ${response.status}`);
        }

        return response.json();
      })
      .then(createCatalog);
  }

  return catalogPromise;
}
