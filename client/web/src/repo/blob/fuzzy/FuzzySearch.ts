import { HighlightedTextProps } from './HighlightedText'

export interface FuzzySearchParameters {
    value: string
    maxResults: number
}
export interface FuzzySearchResult {
    values: HighlightedTextProps[]
    isComplete: boolean
}

export abstract class FuzzySearch {
    constructor() {}
    public abstract search(params: FuzzySearchParameters): FuzzySearchResult
}
