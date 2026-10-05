import { Excalidraw } from '@excalidraw/excalidraw';
import { createElement } from 'react';
import { createRoot } from 'react-dom/client';
import type { ExcalidrawModules } from './excalidraw-loader';

/**
 * React, ReactDOM and Excalidraw for the board editor (ADR-0028). Loaded only through `ExcalidrawLoader`
 * (dynamic `import()` of this file). Static imports on purpose: esbuild hands a code-split CommonJS module
 * (React) to a dynamic `import()` as its default export only, while static imports get the named exports.
 */
export const EXCALIDRAW_MODULES: ExcalidrawModules = {
  createRoot: (container) => createRoot(container),
  createElement: (type, props) => createElement(type, props),
  Excalidraw,
};
