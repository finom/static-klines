import { get, operation } from 'vovk';
import { openapi } from 'vovk-client/openapi';

export default class OpenApiController {
  @operation({
    summary: 'OpenAPI 3.1 specification',
    description: 'Full OpenAPI document describing this API. Consume with Scalar, Swagger UI, or any client generator.',
    tags: ['meta'],
  })
  @get('openapi.json', { staticParams: [{}] })
  static getSpec = () => openapi;
}
