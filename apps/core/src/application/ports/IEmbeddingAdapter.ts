export interface IEmbeddingAdapter {
  embed(inputs: string[]): Promise<number[][]>
}
