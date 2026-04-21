import { get, operation } from 'vovk';
import { openapi } from 'vovk-client/openapi';

export default class OpenApiController {
  @operation({
    summary: 'OpenAPI 3.1 specification',
    description: 'Full OpenAPI document describing this API. Served at the API root so `GET /api` returns the spec directly.',
    tags: ['meta'],
  })
  @get('', { staticParams: [{}] })
  static getSpec = () => openapi;
}
