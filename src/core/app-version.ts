/**
 * The app's version, such as "1.0.0". It is set only in package.json; the build writes it in
 * place of __APP_VERSION__ (see `define` in scripts/lib/build-options.mjs).
 */

declare const __APP_VERSION__: string;

export const APP_VERSION: string = __APP_VERSION__;
