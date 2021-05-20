import * as fzy from 'fzy.js'

import { FuzzySearch, FuzzySearchParameters, FuzzySearchResult, SearchValue } from './FuzzySearch'
import { HighlightedTextProps, RangePosition } from './HighlightedText'

interface ScoredSearchValue extends SearchValue {
    score: number
}

class CacheCandidate {
    constructor(public readonly query: string, public readonly candidates: SearchValue[]) {}
    public matches(parameters: FuzzySearchParameters): boolean {
        return parameters.query.startsWith(this.query)
    }
}

/**
 * FuzzySearch implementation that uses the original fzy filtering algorithm from https://github.com/jhawthorn/fzy.js
 */
export class CaseInsensitiveFuzzySearch extends FuzzySearch {
    public totalFileCount: number
    // Optimization: stack of results from the previous queries. For example,
    // when the user types ["P", "r", "o"] the stack contains the matching
    // results for the queries ["P", "Pr", "Pro"]. When we get the query "Prov"
    // we fuzzy match against the cached candidates for the query "Pro", which
    // is most likely faster compared to fuzzy matching against the entire
    // filename corpu. We cache all prefixes of the query instead of only the
    // last query to allow the user to quickly delete // multiple characters
    // from the query.
    private cacheCandidates: CacheCandidate[] = []

    constructor(public readonly values: SearchValue[]) {
        super()
        this.totalFileCount = values.length
    }

    public search(parameters: FuzzySearchParameters): FuzzySearchResult {
        const cacheCandidate = this.nextCacheCandidate(parameters)
        const searchValues: SearchValue[] = cacheCandidate ? cacheCandidate.candidates : this.values
        const isEmptyQuery = parameters.query.length === 0
        const candidates: ScoredSearchValue[] = []
        for (const value of searchValues) {
            const score = fzy.score(parameters.query, value.text)
            const isAcceptableScore = !isNaN(score) && isFinite(score) && score > 0.2
            if (isEmptyQuery || isAcceptableScore) {
                candidates.push({
                    score,
                    text: value.text,
                })
            }
        }

        this.cacheCandidates.push(new CacheCandidate(parameters.query, [...candidates]))

        const isComplete = candidates.length < parameters.maxResults
        candidates.sort((a, b) => b.score - a.score)
        candidates.slice(0, parameters.maxResults)

        const results: HighlightedTextProps[] = candidates.map(candidate => {
            const positions: RangePosition[] = fzy
                .positions(parameters.query, candidate.text)
                .map(offset => ({ startOffset: offset, endOffset: offset + 1, isExact: false }))
            return {
                positions,
                text: candidate.text,
                onClick: parameters.onClick,
                url: parameters.createUrl?.(candidate.text),
            }
        })
        return {
            isComplete,
            results,
        }
    }

    /**
     * Returns the results from the last query, if any, that is a prefix of the current query.
     *
     * Removes cached candidates that are no longer a prefix of the current
     * query.
     */
    private nextCacheCandidate(parameters: FuzzySearchParameters): CacheCandidate | undefined {
        let cacheCandidate = this.lastCacheCandidate()
        while (cacheCandidate && !cacheCandidate.matches(parameters)) {
            this.cacheCandidates.pop()
            cacheCandidate = this.lastCacheCandidate()
        }
        return cacheCandidate
    }

    private lastCacheCandidate(): CacheCandidate | undefined {
        if (this.cacheCandidates.length > 0) {
            return this.cacheCandidates[this.cacheCandidates.length - 1]
        }
        return undefined
    }
}
