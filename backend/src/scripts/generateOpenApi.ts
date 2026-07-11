import fs from 'node:fs';
import path from 'node:path';
import { serializeOpenApiDocument } from '../openapi/document';

const outputPath = path.resolve(__dirname, '../../../docs/openapi.json');
fs.writeFileSync(outputPath, serializeOpenApiDocument(), 'utf8');
console.log(`Generated ${outputPath}`);
