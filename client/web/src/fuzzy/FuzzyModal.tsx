import { FileLocationsNoGroupSelected } from '@sourcegraph/branded/src/components/panel/views/FileLocations'
import { gql } from '@sourcegraph/shared/src/graphql/graphql'
import React, { useState } from 'react'
import { requestGraphQL } from '../backend/graphql'
import { BloomFilterFuzzySearch } from '../repo/blob/fuzzy/BloomFilterFuzzySearch'
import { FuzzySearch, FuzzySearchParameters, FuzzySearchResult } from '../repo/blob/fuzzy/FuzzySearch'
import { HighlightedText, HighlightedTextProps } from '../repo/blob/fuzzy/HighlightedText'
import { useLocalStorage } from '../repo/blob/fuzzy/useLocalStorage'

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
    const [query, setQuery] = useLocalStorage('fuzzy-modal.query', '')
    const [focusIndex, setFocusIndex] = useState(0)
    return (
        <div className="fuzzy-modal" onClick={props.onClose}>
            <div className="fuzzy-modal-content" onClick={e => e.stopPropagation()}>
                <div className="fuzzy-modal-header">
                    <div className="fuzzy-modal-cursor">
                        <input
                            id="fuzzy-modal-input"
                            value={query}
                            onChange={e => setQuery(e.target.value)}
                            type="text"
                            onKeyUp={e => {
                                switch (e.key) {
                                    case 'Escape':
                                        props.onClose()
                                        break
                                    default:
                                        console.log(e.key)
                                }
                            }}
                        />
                        <i></i>
                    </div>
                </div>
                <div className="fuzzy-modal-body">{renderFiles(props, query)}</div>
                <div className="fuzzy-modal-footer">
                    <button className="button" onClick={props.onClose}>
                        Close
                    </button>
                </div>
            </div>
        </div>
    )
}

function renderFiles(props: FuzzyModalProps, query: string): JSX.Element {
    let [files, setFiles] = useLocalStorage<Loaded<string[]>>(`fuzzy-modal.${props.repoName}.${props.commitID}`, {
        key: 'empty',
    })
    console.log(files.key)
    if (files.key === 'ready' && files.value.length === 0) {
        files = { key: 'empty' }
    }

    switch (files.key) {
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
            setFiles({ key: 'loading' })
            request.subscribe(
                (e: any) => {
                    console.log(e.data)
                    const response = e.data.repository.commit.tree.files.map((f: any) => f.path) as string[]
                    if (response) {
                        setFiles({
                            key: 'ready',
                            value: response,
                        })
                    } else {
                        setFiles({
                            key: 'failed',
                            errorMessage: JSON.stringify(e.data),
                        })
                    }
                },
                e => {
                    setFiles({
                        key: 'failed',
                        errorMessage: JSON.stringify(e),
                    })
                }
            )
            return <></>
        case 'loading':
            return <p>Loading...</p>
        case 'failed':
            return <p>Error: {files.errorMessage}</p>
        case 'ready':
            if (!files.fuzzy) {
                files.fuzzy = new BloomFilterFuzzySearch(files.value)
            }
            console.log(files.fuzzy)
            const matchingFiles = files.fuzzy.search({
                value: query,
                maxResults: MAX_RESULTS,
            }).values

            if (matchingFiles.length === 0) {
                return <p>No files found matching query '{query}'</p>
            }
            return (
                <ul className="fuzzy-modal-results">
                    {matchingFiles.slice(0, MAX_RESULTS).map(file => (
                        <li key={file.text}>
                            <HighlightedText value={file} />
                        </li>
                    ))}
                </ul>
            )
        default:
            return <p>ERROR</p>
    }
}
