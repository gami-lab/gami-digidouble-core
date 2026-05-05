export type DeleteUserMemoryFactInput = {
  userId: string
  factId: string
}

export type DeleteUserMemoryFactOutput = {
  factId: string
  deleted: true
}
