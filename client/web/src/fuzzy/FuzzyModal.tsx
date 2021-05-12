import { gql } from '@sourcegraph/shared/src/graphql/graphql'
import React from 'react'
import { requestGraphQL } from '../backend/graphql'
import { BloomFilterFuzzySearch } from '../repo/blob/fuzzy/BloomFilterFuzzySearch'
import { FuzzySearch } from '../repo/blob/fuzzy/FuzzySearch'
import { HighlightedText, HighlightedTextProps } from '../repo/blob/fuzzy/HighlightedText'
import { useEphemeralState, useLocalStorage, State } from '../repo/blob/fuzzy/useLocalStorage'

const MAX_RESULTS = 100

interface Empty {
    key: 'empty'
}

interface Loading {
    key: 'loading'
}

interface Ready<T> {
    key: 'ready'
    value: T
    fuzzy?: FuzzySearch
}

interface Failed {
    key: 'failed'
    errorMessage: string
}

type Loaded<T> = Empty | Loading | Ready<T> | Failed

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
    const query = useLocalStorage('fuzzy-modal.query', '')
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
                    <button className="button" onClick={props.onClose}>
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

function renderFiles(props: FuzzyModalProps, query: State<string>, focusIndex: State<number>): RenderedFiles {
    let files = useLocalStorage<Loaded<string[]>>(`fuzzy-modal.${props.repoName}.${props.commitID}`, {
        key: 'empty',
    })

    function empty(elem: JSX.Element): RenderedFiles {
        return {
            element: elem,
            results: [],
        }
    }

    switch (files.value.key) {
        case 'empty':
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
                    console.log(e.data)
                    const response = e.data.repository.commit.tree.files.map((f: any) => f.path) as string[]
                    if (response) {
                        files.set({
                            key: 'ready',
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
            return empty(<></>)
        case 'loading':
            return empty(<p>Loading...</p>)
        case 'failed':
            return empty(<p>Error: {files.value.errorMessage}</p>)
        case 'ready':
            if (!files.value.fuzzy) {
                files.value.fuzzy = new BloomFilterFuzzySearch(
                    files.value.value.map(f => ({ value: f, url: `/${props.repoName}@${props.commitID}/-/blob/${f}` }))
                )
            }
            const matchingFiles = files.value.fuzzy.search({
                value: query.value,
                maxResults: MAX_RESULTS,
            }).values

            if (matchingFiles.length === 0) {
                return empty(<p>No files found matching query '{query}'</p>)
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
                    </ul>
                ),
                results: filesToRender,
            }
        default:
            return empty(<p>ERROR</p>)
    }
}
