declare const __MIRAE_BUNDLED_OPENROUTER_API_KEY__: string;
declare const __MIRAE_BUNDLED_UNISWAP_API_KEY__: string;

// Release workflows inject managed defaults at build time so credentials are
// available in the installer without being committed to the public source.
export const BUNDLED_OPENROUTER_API_KEY =
  typeof __MIRAE_BUNDLED_OPENROUTER_API_KEY__ === "string"
    ? __MIRAE_BUNDLED_OPENROUTER_API_KEY__
    : "";

export const BUNDLED_UNISWAP_API_KEY =
  typeof __MIRAE_BUNDLED_UNISWAP_API_KEY__ === "string"
    ? __MIRAE_BUNDLED_UNISWAP_API_KEY__
    : "";
