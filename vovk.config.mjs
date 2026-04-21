// @ts-check
/** @type {import('vovk').VovkConfig} */
const config = {
  outputConfig: {
    imports: {
      validateOnClient: 'vovk-ajv',
    },
  },
  moduleTemplates: {
    controller: 'vovk-cli/module-templates/zod/controller.ts.ejs',
    service: 'vovk-cli/module-templates/type/service.ts.ejs',
  },
};

export default config;
