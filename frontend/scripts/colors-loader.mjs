// Module hooks of scripts/colors.mjs: Node runs the TypeScript of the colour engine as it is.
// `resolve` finds a relative import written without an extension (`./color` → `./color.ts`; the colour
// library 0.4.0 imports its own files without `.js`), `load` strips the types with TypeScript.
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const EXTENSIONS = ['.ts', '.js'];

export async function resolve(specifier, context, nextResolve) {
  try {
    return await nextResolve(specifier, context);
  } catch (error) {
    if (!specifier.startsWith('.')) throw error;
    for (const extension of EXTENSIONS) {
      try {
        return await nextResolve(specifier + extension, context);
      } catch {
        // the next extension
      }
    }
    throw error;
  }
}

export async function load(url, context, nextLoad) {
  if (!url.endsWith('.ts')) return nextLoad(url, context);
  const { outputText } = ts.transpileModule(await readFile(fileURLToPath(url), 'utf8'), {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
      verbatimModuleSyntax: false,
    },
    fileName: fileURLToPath(url),
  });
  return { format: 'module', source: outputText, shortCircuit: true };
}
