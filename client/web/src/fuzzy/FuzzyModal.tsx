import { gql } from '@sourcegraph/shared/src/graphql/graphql'
import React from 'react'
import { requestGraphQL } from '../backend/graphql'
import { useLocalStorage } from '../repo/blob/fuzzy/useLocalStorage'

interface Empty {
    key: 'empty'
}
interface Loading {
    key: 'loading'
}

interface Ready<T> {
    key: 'ready'
    value: T
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
    commitID?: string
}

export const FuzzyModal: React.FunctionComponent<FuzzyModalProps> = props => {
    console.log('FUZZYMODAL')
    // useEffect(() => {
    //     function onEscape(e: KeyboardEvent) {
    //         switch (e.key) {
    //             case 'Escape':
    //                 props.onClose()
    //                 break
    //             default:
    //         }
    //     }
    //     document.body.addEventListener('keydown', onEscape)
    //     return function cleanup() {
    //         document.body.removeEventListener('keydown', onEscape)
    //     }
    // }, [props])
    if (!props.isVisible) {
        return null
    }
    return (
        <div className="fuzzy-modal" onClick={props.onClose}>
            <div className="fuzzy-modal-content" onClick={e => e.stopPropagation()}>
                <div className="fuzzy-modal-header">
                    <h4 className="fuzzy-modal-title">Files</h4>
                </div>
                <div className="fuzzy-modal-body">{renderFiles(props)}</div>
                <div className="fuzzy-modal-footer">
                    <button className="button" onClick={props.onClose}>
                        Close
                    </button>
                </div>
            </div>
        </div>
    )
}

function renderFiles(props: FuzzyModalProps): JSX.Element {
    let [files, setFiles] = useLocalStorage<Loaded<string[]>>('fuzzy-modal.files', { key: 'empty' })
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
            request.subscribe(
                (e: any) => {
                    console.log(e.data)
                    const response = e.data.repository.commit.tree.files.map((f: any) => f.path)
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
            return <p>EMPTY</p>
        case 'failed':
            return <p>Error: {files.errorMessage}</p>
        case 'loading':
            return <p>Loading...</p>
        case 'ready':
            console.log(files)
            if (files.value.length === 0) {
                return <p>No files found in this repo</p>
            }
            return (
                <ul>
                    {files.value.map(file => (
                        <li key={file}>{file}</li>
                    ))}
                </ul>
            )
        default:
            return <p>ERROR</p>
    }
}
