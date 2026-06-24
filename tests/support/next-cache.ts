const revalidatedPaths: string[] = []

export function revalidatePath(path: string) {
  revalidatedPaths.push(path)
}

export function getRevalidatedPaths() {
  return [...revalidatedPaths]
}

export function resetRevalidatedPaths() {
  revalidatedPaths.length = 0
}
