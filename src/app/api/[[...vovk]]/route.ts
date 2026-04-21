import { initSegment } from 'vovk';

const controllers = {};

export type Controllers = typeof controllers;

export const { GET, POST, PATCH, PUT, HEAD, OPTIONS, DELETE } = initSegment({
  emitSchema: true,
  controllers,
});
