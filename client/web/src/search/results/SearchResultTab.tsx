import * as React from 'react'
import * as H from 'history'
import { SearchType } from './SearchResults'
import { NavLink } from 'react-router-dom'
import { toggleSearchType } from '../helpers'
import { buildSearchURLQuery } from '../../../../shared/src/util/url'
import { constant } from 'lodash'
import { PatternTypeProps, CaseSensitivityProps, parseSearchURLQuery } from '..'
import { scanSearchQuery } from '../../../../shared/src/search/query/scanner'
import { VersionContextProps } from '../../../../shared/src/search/util'

interface Props
    extends Omit<PatternTypeProps, 'setPatternType'>,
        Omit<CaseSensitivityProps, 'setCaseSensitivity'>,
        VersionContextProps {
    location: H.Location
    type: SearchType
    query: string
}

const typeToProse: Record<Exclude<SearchType, null>, string> = {
    diff: 'Diffs',
    commit: 'Commits',
    symbol: 'Symbols',
    repo: 'Repositories',
    path: 'Filenames',
}

export const SearchResultTabHeader: React.FunctionComponent<Props> = ({
    location,
    type,
    query,
    patternType,
    caseSensitive,
    versionContext,
}) => {
    const caseToggledQuery = toggleSearchType(query, type)
    const builtURLQuery = buildSearchURLQuery(caseToggledQuery, patternType, caseSensitive, versionContext)

    const currentQuery = parseSearchURLQuery(location.search) || ''
    const scannedQuery = scanSearchQuery(currentQuery)
    let typeInQuery: SearchType = null

    if (scannedQuery.type === 'success') {
        // Parse any `type:` filter that exists in a query so
        // we can check whether this tab should be active.
        for (const token of scannedQuery.term) {
            if (token.type === 'filter' && token.field.value === 'type' && token.value) {
                typeInQuery =
                    token.value.type === 'literal'
                        ? (token.value.value as SearchType)
                        : (token.value.quotedValue as SearchType)
            }
        }
    }

    const isActiveFunc = constant(typeInQuery === type)
    return (
        <li className="nav-item test-search-result-tab">
            <NavLink
                to={{ pathname: '/search', search: builtURLQuery }}
                className={`nav-link test-search-result-tab-${String(type)}`}
                activeClassName="active test-search-result-tab--active"
                isActive={isActiveFunc}
            >
                {type ? typeToProse[type] : 'Code'}
            </NavLink>
        </li>
    )
}
