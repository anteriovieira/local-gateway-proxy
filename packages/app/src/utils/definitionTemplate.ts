export const buildDefinitionTemplate = (integrationProperty = 'x-amazon-apigateway-integration') =>
  JSON.stringify(
    {
      paths: {
        '/users/{id}': {
          get: {
            [integrationProperty]: {
              type: 'http_proxy',
              httpMethod: 'GET',
              uri: '${stageVariables.baseUrl}/users/{id}',
            },
          },
        },
        '/health': {
          get: {
            [integrationProperty]: {
              type: 'mock',
              responses: {
                default: {
                  statusCode: '200',
                  responseTemplates: { 'application/json': '{"status":"ok"}' },
                },
              },
            },
          },
        },
      },
    },
    null,
    2
  )
