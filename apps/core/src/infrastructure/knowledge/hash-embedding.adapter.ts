import type { IEmbeddingAdapter } from '../../application/ports/IEmbeddingAdapter.js'

const DEFAULT_DIMENSION = 16

export class HashEmbeddingAdapter implements IEmbeddingAdapter {
  constructor(private readonly dimensions = DEFAULT_DIMENSION) {}

  embed(inputs: string[]): Promise<number[][]> {
    return Promise.resolve(inputs.map((input) => toVector(input, this.dimensions)))
  }
}

function toVector(input: string, dimensions: number): number[] {
  const values = new Array<number>(dimensions).fill(0)
  for (let i = 0; i < input.length; i += 1) {
    const code = input.charCodeAt(i)
    const index = i % dimensions
    values[index] = (values[index] ?? 0) + code
  }

  const norm = Math.sqrt(values.reduce((acc, value) => acc + value * value, 0)) || 1
  return values.map((value) => Number((value / norm).toFixed(6)))
}
