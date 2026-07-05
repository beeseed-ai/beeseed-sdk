import ky, { type KyInstance } from 'ky'
import { ApiError } from './errors.js'

export interface ClientConfig {
  workerUrl: string
  getToken: () => string | null
}

export function createApiClient(config: ClientConfig): KyInstance {
  return ky.create({
    prefix: config.workerUrl ? `${config.workerUrl}/api` : '/api',
    timeout: 60_000,
    hooks: {
      beforeRequest: [
        ({ request }) => {
          const token = config.getToken()
          if (token) request.headers.set('Authorization', `Bearer ${token}`)
        },
      ],
      afterResponse: [
        async ({ response }) => {
          if (!response.ok) {
            const body = await response.json().catch(() => ({})) as Record<string, unknown>
            throw new ApiError(
              (body['error'] as string) || `${response.status} ${response.statusText}`,
              response.status,
              body['code'] as string | undefined,
              body,
            )
          }
        },
      ],
    },
  })
}
