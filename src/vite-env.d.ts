/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_APP_ENV?: 'preview' | 'dev' | 'test' | 'prod'
  readonly VITE_DATA_MODE?: 'mock' | 'api'
  readonly VITE_API_BASE_URL?: string
  readonly VITE_BRIDGE_MODE?: 'disabled' | 'mock' | 'native'
  readonly VITE_MALL_TARGET?: 'kbs_shop' | 'kbs_shop2'
  readonly VITE_BUILD_SHA?: string
  readonly VITE_BUILD_ID?: string
  readonly VITE_SOURCE_BRANCH?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
