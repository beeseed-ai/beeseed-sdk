import { useBeeSeedContext } from '../provider/BeeSeedProvider.js'
import { resolveAppBranding } from '../core/app-config.js'

export function useAppConfig() {
  const { config } = useBeeSeedContext()
  const appConfig = config.appConfig ?? {}

  return {
    appConfig,
    branding: resolveAppBranding(appConfig),
  }
}
