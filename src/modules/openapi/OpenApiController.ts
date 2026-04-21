import { get, operation } from 'vovk';
import { openapi } from 'vovk-client/openapi';

export default class OpenApiController {
  @operation({
    summary: 'OpenAPI 3.1 specification',
    description: 'Full OpenAPI document describing this API. Consume with Scalar, Swagger UI, or any OpenAPI-based client generator.',
    tags: ['meta'],
  })
  // `@get('')` would make the route serve at /api — but /api is already a
  // directory (it contains /api/klines/...), so Next.js static export fails
  // with EISDIR trying to emit the body as a file. Keep it at /openapi.json.
  @get('openapi.json', { staticParams: [{}] })
  static getSpec = () => openapi;
}
