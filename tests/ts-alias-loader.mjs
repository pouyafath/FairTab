import { existsSync, statSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import ts from 'typescript'

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const extensions = ['.ts', '.tsx', '.js', '.mjs', '.cjs']

function resolveExistingFile(basePath) {
  if (existsSync(basePath) && statSync(basePath).isFile()) return basePath

  for (const extension of extensions) {
    const filePath = `${basePath}${extension}`
    if (existsSync(filePath)) return filePath
  }

  for (const extension of extensions) {
    const indexPath = path.join(basePath, `index${extension}`)
    if (existsSync(indexPath)) return indexPath
  }

  return null
}

export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith('@/')) {
    const resolved = resolveExistingFile(path.join(projectRoot, specifier.slice(2)))
    if (resolved) return { url: pathToFileURL(resolved).href, shortCircuit: true }
  }

  if (
    (specifier.startsWith('./') || specifier.startsWith('../')) &&
    context.parentURL?.startsWith('file:')
  ) {
    const parentDirectory = path.dirname(fileURLToPath(context.parentURL))
    const resolved = resolveExistingFile(path.resolve(parentDirectory, specifier))
    if (resolved) return { url: pathToFileURL(resolved).href, shortCircuit: true }
  }

  return nextResolve(specifier, context)
}

export async function load(url, context, nextLoad) {
  if (url.endsWith('.ts') || url.endsWith('.tsx')) {
    const source = await readFile(fileURLToPath(url), 'utf8')
    const transpiled = ts.transpileModule(source, {
      compilerOptions: {
        jsx: ts.JsxEmit.ReactJSX,
        module: ts.ModuleKind.ESNext,
        target: ts.ScriptTarget.ES2022,
        esModuleInterop: true,
      },
    })

    return {
      format: 'module',
      source: transpiled.outputText,
      shortCircuit: true,
    }
  }

  return nextLoad(url, context)
}
