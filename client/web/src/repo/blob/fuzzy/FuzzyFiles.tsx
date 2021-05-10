import { Shortcut } from '@slimsag/react-shortcuts'
import React from 'react'
import { HighlightedText, HighlightedTextProps } from './HighlightedText'
import { useLocalStorage } from './useLocalStorage'

export interface QueryProps {
    value: string
    maxResults: number
}
export interface FuzzyFilesProps {
    search(query: QueryProps): HighlightedTextProps[]
}

const MAX_RESULTS = 100

export const FuzzyFiles: React.FunctionComponent<FuzzyFilesProps> = props => {
    const [query, setQuery] = useLocalStorage<string>('fuzzy-files.query', '')
    const [focusIndex, setFocusIndex] = useLocalStorage<number>('fuzzy-files.focus-index', 0)
    const start = new Date()
    const candidates = props.search({
        value: query,
        maxResults: MAX_RESULTS,
    })

    // console.log(`query=${query} candidates=${candidates.map((e) => e.text)}`);
    const end = new Date()
    const elapsed = Math.max(0, end.getMilliseconds() - start.getMilliseconds())
    const visibleCandidates = candidates.slice(0, MAX_RESULTS)
    const nonVisibleCandidates = candidates.length - visibleCandidates.length
    const roundedFocusIndex = Math.abs(focusIndex % visibleCandidates.length)
    console.log(roundedFocusIndex)

    return (
        <>
            <input
                type="text"
                onChange={e => setQuery(e.target.value)}
                value={query}
                onKeyUp={e => {
                    switch (e.key) {
                        case 'ArrowDown':
                            setFocusIndex(focusIndex + 1)
                            break
                        case 'ArrowUp':
                            setFocusIndex(focusIndex - 1)
                            break
                        case 'Enter':
                            setFocusIndex(focusIndex - 1)
                            break
                    }
                }}
            ></input>
            <p>
                {candidates.length} result{candidates.length !== 1 && 's'} in {elapsed}
                ms
                {nonVisibleCandidates > 1 && ` (only showing top ${MAX_RESULTS} results)`}
            </p>
            <ul className="fuzzy-files-results">
                {visibleCandidates.map((f, index) => {
                    return (
                        <li key={f.text} className={index === focusIndex ? 'fuzzy-files-focused' : ''}>
                            <HighlightedText value={f} />
                        </li>
                    )
                })}
                {nonVisibleCandidates > 0 && (
                    <li key="fuzzy-files-hidden-results">
                        (...{nonVisibleCandidates} hidden results, type more to narrow your filter)
                    </li>
                )}
            </ul>
        </>
    )
}
