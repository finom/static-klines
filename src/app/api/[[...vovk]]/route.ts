import { controllersToStaticParams, initSegment } from 'vovk';
import KLinesController from '@/modules/klines/KLinesController';
import OpenApiController from '@/modules/openapi/OpenApiController';

const controllers = {
  KLinesAPI: KLinesController,
  OpenAPI: OpenApiController,
};

export type Controllers = typeof controllers;

export const dynamic = 'force-static';
export const dynamicParams = false;

export function generateStaticParams() {
  return controllersToStaticParams(controllers);
}

export const { GET } = initSegment({
  emitSchema: true,
  controllers,
});
