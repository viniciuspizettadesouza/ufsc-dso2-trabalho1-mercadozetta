import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { createOpenApiDocument, serializeOpenApiDocument } from '../src/openapi/document';
import routes from '../src/routes';

type OpenApiDocument = {
  openapi: string;
  paths: Record<string, Record<string, unknown>>;
};

const documentPath = path.resolve(__dirname, '../../docs/openapi.json');
const checkedInDocument = fs.readFileSync(documentPath, 'utf8');
const document = createOpenApiDocument() as unknown as OpenApiDocument;

function normalizeExpressPath(routePath: string) {
  return routePath.replace(/:([^/]+)/g, '{$1}');
}

function implementedOperations() {
  return routes.stack.flatMap((layer: any) => {
    if (!layer.route)
      return [];

    return Object.keys(layer.route.methods).map(method => (
      `${method.toLowerCase()} ${normalizeExpressPath(layer.route.path)}`
    ));
  }).sort();
}

function documentedOperations() {
  return Object.entries(document.paths).flatMap(([routePath, pathItem]) => (
    Object.keys(pathItem)
      .filter(method => ['get', 'post', 'put', 'patch', 'delete'].includes(method))
      .map(method => `${method} ${routePath}`)
  )).sort();
}

describe('OpenAPI contract', () => {
  it('matches the deterministically generated document', () => {
    expect(checkedInDocument).toBe(serializeOpenApiDocument());
  });

  it('uses OpenAPI 3.1 and documents every implemented route exactly once', () => {
    expect(document.openapi).toBe('3.1.0');
    expect(documentedOperations()).toEqual(implementedOperations());
  });

  it('includes request and response examples for API operations with payloads', () => {
    expect(document.paths['/auth/login'].post).toHaveProperty('requestBody.content.application/json.example');
    expect(document.paths['/auth/login'].post).toHaveProperty('responses.200.content.application/json.example');
    expect(document.paths['/users'].post).toHaveProperty('requestBody.content.application/json.example');
    expect(document.paths['/products'].post).toHaveProperty('requestBody.content.application/json.example');
    expect(document.paths['/products/{productId}'].get).toHaveProperty('responses.200.content.application/json.example');
    expect(document.paths['/ready'].get).toHaveProperty('responses.503.content.application/json.example');
  });
});
