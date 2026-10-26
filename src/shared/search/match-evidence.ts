export interface SearchMatchEvidence {
  field: string
  term: string
  /** Original matched text, populated by the scorer for visible fields. */
  text?: string[]
  literal?: boolean
}
