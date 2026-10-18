import type { CatalogRepository } from '../db/catalog-repository.js';

export function metaBase(repository: CatalogRepository) {
  return {
    generatedAt: new Date().toISOString(),
    dataVersion: repository.dataVersion,
    synthetic: true as const,
  };
}
