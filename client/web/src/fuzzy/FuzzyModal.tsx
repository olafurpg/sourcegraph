import { gql } from '@sourcegraph/shared/src/graphql/graphql'
import React from 'react'
import { requestGraphQL } from '../backend/graphql'
import { BloomFilterFuzzySearch } from '../repo/blob/fuzzy/BloomFilterFuzzySearch'
import { FuzzySearch, FuzzySearchResult } from '../repo/blob/fuzzy/FuzzySearch'
import { HighlightedText, HighlightedTextProps } from '../repo/blob/fuzzy/HighlightedText'
import { useEphemeralState, useLocalStorage, State } from '../repo/blob/fuzzy/useLocalStorage'

const MAX_RESULTS = 100

interface Empty {
    key: 'empty'
}

interface Loading {
    key: 'loading'
}

interface Indexing {
    key: 'indexing'
    value: string[]
}

interface Ready {
    key: 'ready'
    fuzzy: FuzzySearch
}

interface Failed {
    key: 'failed'
    errorMessage: string
}

type Loaded = Empty | Loading | Indexing | Ready | Failed
type FilesState = State<Loaded>

export interface FuzzyModalProps {
    isVisible: boolean
    onClose(): void
    repoName: string
    commitID: string
}

export const FuzzyModal: React.FunctionComponent<FuzzyModalProps> = props => {
    if (!props.isVisible) {
        return null
    }
    const query = useLocalStorage(`fuzzy-modal.query.${props.repoName}`, '')
    const focusIndex = useEphemeralState(0)
    const body = renderFiles(props, query, focusIndex)
    function setRoundedFocusIndex(newNumber: number) {
        const N = body.results.length
        const i = newNumber % N
        const nextIndex = i < 0 ? N + i : i
        focusIndex.set(nextIndex)
        document.getElementById(`fuzzy-modal-result-${nextIndex}`)?.scrollIntoView(false)
    }
    return (
        <div className="fuzzy-modal" onClick={props.onClose}>
            <div className="fuzzy-modal-content" onClick={e => e.stopPropagation()}>
                <div className="fuzzy-modal-header">
                    <div className="fuzzy-modal-cursor">
                        <input
                            autoComplete="off"
                            id="fuzzy-modal-input"
                            value={query.value}
                            onChange={e => {
                                query.set(e.target.value)
                                focusIndex.set(0)
                            }}
                            type="text"
                            onKeyDown={e => {
                                switch (e.key) {
                                    case 'Escape':
                                        props.onClose()
                                        break
                                    case 'ArrowDown':
                                        setRoundedFocusIndex(focusIndex.value + 1)
                                        break
                                    case 'ArrowUp':
                                        setRoundedFocusIndex(focusIndex.value - 1)
                                        break
                                    case 'Enter':
                                        if (focusIndex.value < body.results.length) {
                                            const url = body.results[focusIndex.value].url
                                            if (url) {
                                                window.location.href = url
                                            }
                                        }
                                        break
                                    default:
                                        console.log(e.key)
                                }
                            }}
                        />
                        <i></i>
                    </div>
                </div>
                <div className="fuzzy-modal-body">{body.element}</div>
                <div className="fuzzy-modal-footer">
                    <button className="btn btn-secondary" onClick={props.onClose}>
                        Close
                    </button>
                </div>
            </div>
        </div>
    )
}

interface RenderedFiles {
    element: JSX.Element
    results: HighlightedTextProps[]
}
const cachedResult = new Map<string, FuzzySearchResult>()

function renderFiles(props: FuzzyModalProps, query: State<string>, focusIndex: State<number>): RenderedFiles {
    let files = useEphemeralState<Loaded>({ key: 'empty' })

    function empty(elem: JSX.Element): RenderedFiles {
        return {
            element: elem,
            results: [],
        }
    }

    switch (files.value.key) {
        case 'empty':
            handleEmpty(props, files)
            return empty(<></>)
        case 'loading':
            return empty(<p>Downloading all filenames in this repository...</p>)
        case 'failed':
            return empty(<p>Error: {files.value.errorMessage}</p>)
        case 'indexing':
            handleIndexing(props, files.value.value).then(next => {
                files.set(next)
            })
            return empty(
                <p>
                    Indexing... This step is usually very fast unless the repo has a large number of files. The indexing
                    step is cached so you only have to wait for it once :)
                </p>
            )
        case 'ready':
            let fuzzyResult = cachedResult.get(query.value)
            if (!fuzzyResult) {
                fuzzyResult = files.value.fuzzy.search({
                    value: query.value,
                    maxResults: MAX_RESULTS,
                })
                cachedResult.clear() // Only store one result
                cachedResult.set(query.value, fuzzyResult)
            }
            const matchingFiles = fuzzyResult.values

            if (matchingFiles.length === 0) {
                return empty(<p>No files matching '{query.value}'</p>)
            }
            const filesToRender = matchingFiles.slice(0, MAX_RESULTS)
            return {
                element: (
                    <ul className="fuzzy-modal-results">
                        {filesToRender.map((file, i) => (
                            <li
                                id={`fuzzy-modal-result-${i}`}
                                key={file.text}
                                className={i === focusIndex.value ? 'fuzzy-modal-focused' : ''}
                            >
                                <HighlightedText value={file} />
                            </li>
                        ))}
                        {!fuzzyResult.isComplete && (
                            <li>(...truncated, type more characters to see additional results)</li>
                        )}
                    </ul>
                ),
                results: filesToRender,
            }
        default:
            return empty(<p>ERROR</p>)
    }
}

function filesCacheKey(props: FuzzyModalProps): string {
    return `/fuzzy-modal.files.${props.repoName}.${props.commitID}`
}

function openCaches(): Promise<Cache> {
    return caches.open('fuzzy-modal')
}

async function handleIndexing(props: FuzzyModalProps, files: string[]): Promise<Ready> {
    const result = await new Promise<Ready>(resolve =>
        setTimeout(
            () =>
                resolve({
                    key: 'ready',
                    fuzzy: BloomFilterFuzzySearch.fromSearchValues(
                        files.map(f => ({ value: f, url: `/${props.repoName}@${props.commitID}/-/blob/${f}` }))
                    ),
                }),
            0
        )
    )
    const cache = await openCaches()
    const text = serializeIndex(result)
    if (text) {
        console.log(text)
        await cache.put(new Request(filesCacheKey(props)), text)
    }
    return result
}

async function deserializeIndex(ready: Response): Promise<Ready> {
    return {
        key: 'ready',
        fuzzy: BloomFilterFuzzySearch.fromSerializedString(await ready.text()),
    }
}

function serializeIndex(ready: Ready): Response | undefined {
    const serializable = ready.fuzzy.serialize()
    console.log(serializable)
    return serializable ? new Response(JSON.stringify(serializable)) : undefined
}

async function handleEmpty(props: FuzzyModalProps, files: FilesState): Promise<void> {
    const cache = await openCaches()
    const cacheKey = filesCacheKey(props)
    const cacheRequest = new Request(cacheKey)
    const fromCache = await cache.match(cacheRequest)
    if (fromCache) {
        files.set(await deserializeIndex(fromCache))
    } else {
        let request = requestGraphQL(
            gql`
                query Files($repository: String!, $commit: String!) {
                    repository(name: $repository) {
                        commit(rev: $commit) {
                            tree(recursive: true) {
                                files(first: 1000000, recursive: true) {
                                    path
                                }
                            }
                        }
                    }
                }
            `,
            {
                repository: props.repoName,
                commit: props.commitID,
            }
        )
        files.set({ key: 'loading' })
        request.subscribe(
            (e: any) => {
                const response = e.data?.repository?.commit?.tree?.files?.map((f: any) => f.path) as
                    | string[]
                    | undefined
                if (response) {
                    cache.put(cacheRequest, new Response(JSON.stringify(response)))
                    files.set({
                        key: 'indexing',
                        value: response,
                    })
                } else {
                    files.set({
                        key: 'failed',
                        errorMessage: JSON.stringify(e.data),
                    })
                }
            },
            e => {
                files.set({
                    key: 'failed',
                    errorMessage: JSON.stringify(e),
                })
            }
        )
    }
}
