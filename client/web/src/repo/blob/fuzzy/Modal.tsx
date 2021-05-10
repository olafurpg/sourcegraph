import React, { useEffect } from 'react'
import { FuzzyFiles } from './FuzzyFiles'
import { fuzzyMatches, FuzzySearch } from './FuzzySearch'
// import { LinuxFiles } from "./LinuxFiles";
import { ChromiumFiles } from './ChromiumFiles'
import { LinuxFiles } from './LinuxFiles'
import { useLocalStorage } from './useLocalStorage'

interface ModalProps {
    show: boolean
    onClose: () => void
}
const all = ['to/the/moon.jpg', 'business/crazy.txt', 'fuzzy/business.txt', 'haha/business.txt', 'lol/business.txt']
// const MAX = 100000;
// const files = [];
// for (var i = 0; i < MAX && i < LinuxFiles.length; i++) {
//   files.push(LinuxFiles[i]);
// }

const search = new FuzzySearch(ChromiumFiles)
// const search = new FuzzySearch(LinuxFiles);
// console.log(search.buckets);
// console.log(search.search("t/moon"));

export const Modal: React.FunctionComponent<ModalProps> = props => {
    useEffect(() => {
        function onEscape(e: KeyboardEvent) {
            if ((e.charCode || e.keyCode) === 27) {
                props.onClose()
            }
        }
        document.body.addEventListener('keydown', onEscape)
        return function cleanup() {
            document.body.removeEventListener('keydown', onEscape)
        }
    }, [props])
    if (!props.show) {
        return null
    }

    return (
        <div className="modal" onClick={props.onClose}>
            <div className="modal-content" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <h4 className="modal-title">Files</h4>
                </div>
                <div className="modal-body">
                    <FuzzyFiles search={e => search.search(e)} />
                </div>
                <div className="modal-footer">
                    <button className="button" onClick={props.onClose}>
                        Close
                    </button>
                </div>
            </div>
        </div>
    )
}
