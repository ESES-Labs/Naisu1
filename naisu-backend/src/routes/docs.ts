/**
 * API Documentation Routes
 * Swagger UI and OpenAPI spec endpoints
 */
import { Hono } from 'hono'
import { swaggerUI } from '@hono/swagger-ui'
import { generateOpenAPIDoc } from '@config/openapi'

export const docsRouter = new Hono()

// OpenAPI JSON spec
docsRouter.get('/openapi.json', (c) => {
  const doc = generateOpenAPIDoc()
  return c.json(doc)
})

// Swagger UI
docsRouter.get(
  '/',
  swaggerUI({
    url: '/docs/openapi.json',
  })
)
  