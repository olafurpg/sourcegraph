import { Hasher } from './Hasher'
import { BloomFilter } from './BloomFilter'
import { HighlightedTextProps, RangePosition } from './HighlightedText'
import { FuzzySearch, FuzzySearchParameters, FuzzySearchResult } from './FuzzySearch'

function isUppercase(str: string): boolean {
    return str.toUpperCase() === str && str !== str.toLowerCase()
}
function isDelimeterOrUppercase(ch: string): boolean {
    return isDelimeter(ch) || isUppercase(ch)
}
function isDelimeter(ch: string): boolean {
    switch (ch) {
        case '/':
        case '_':
        case '-':
        case '.':
        case ' ':
            return true
        default:
            return false
    }
}
function startsFuzzyPart(value: string, i: number): boolean {
    const ch = value[i]
    return !isDelimeter(ch) && (isUppercase(value[i]) || isDelimeter(value[i - 1]))
}

const MAX_VALUE_LENGTH = 100

export function fuzzyMatchesQuery(query: string, value: string): RangePosition[] {
    return fuzzyMatches(allFuzzyParts(query), value)
}
export function fuzzyMatches(queries: string[], value: string): RangePosition[] {
    const result: RangePosition[] = []
    // console.log(queries)
    var queryIndex = 0
    var start = 0
    while (queryIndex < queries.length && start < value.length) {
        const query = queries[queryIndex]
        while (isDelimeter(value[start])) start++
        // console.log(JSON.stringify(value[start]))
        if (value.startsWith(query, start)) {
            const end = start + query.length
            result.push({
                startOffset: start,
                endOffset: end,
                isExact: end < value.length && isDelimeterOrUppercase(value[end]),
            })
            queryIndex++
        }
        let end = nextFuzzyPart(value, start + 1)
        while (end < value.length && isDelimeter(value[end])) end++
        start = end
    }
    return queryIndex >= queries.length ? result : []
}
export function allFuzzyParts(value: string): string[] {
    const buf: string[] = []
    var start = 0
    for (var end = 0; end < value.length; end = nextFuzzyPart(value, end)) {
        // console.log(JSON.stringify(value.substring(start, end)))
        // console.log(JSON.stringify(value.substring(start, end - 1)))
        if (end > start) {
            // let actualEnd = end
            // while (actualEnd > 0 && isDelimeter(value[actualEnd - 1])) actualEnd--
            buf.push(value.substring(start, end))
        }
        while (end < value.length && isDelimeter(value[end])) end++
        start = end
        end++
    }
    buf.push(value.substring(start, end))
    return buf
}
export function nextFuzzyPart(value: string, start: number): number {
    var end = start
    while (end < value.length && !isDelimeterOrUppercase(value[end])) end++
    // console.log(JSON.stringify(value.substring(end)))
    return end
}
const DEFAULT_BLOOM_FILTER_HASH_FUNCTION_COUNT = 8
const DEFAULT_BLOOM_FILTER_SIZE = 2 << 17
function populateBloomFilter(values: SearchValue[]): BloomFilter {
    let hashes = new BloomFilter(DEFAULT_BLOOM_FILTER_SIZE, DEFAULT_BLOOM_FILTER_HASH_FUNCTION_COUNT)
    values.forEach(value => {
        if (value.value.length < MAX_VALUE_LENGTH) {
            updateHashParts(value.value, hashes)
        }
    })
    return hashes
}
function allQueryHashParts(query: string): number[] {
    const fuzzyParts = allFuzzyParts(query)
    const result: number[] = []
    const H = new Hasher()
    // let chars: string[] = []
    for (var i = 0; i < fuzzyParts.length; i++) {
        H.reset()
        // chars = []
        const part = fuzzyParts[i]
        for (var j = 0; j < part.length; j++) {
            H.update(part[j])
            // chars.push(part[j])
        }
        const digest = H.digest()
        // console.log(`part=${part} digest=${digest} chars=${chars.join('')}`)
        result.push(digest)
    }
    return result
}

function updateHashParts(value: string, buf: BloomFilter): void {
    let H = new Hasher()
    // console.log(`value='${value}'`)
    // let chars: string[] = []

    for (var i = 0; i < value.length; i++) {
        const ch = value[i]
        if (isDelimeterOrUppercase(ch)) {
            H.reset()
            // chars = []
        }
        if (isDelimeter(ch)) continue
        H.update(ch)
        // chars.push(ch)
        const digest = H.digest()
        // console.log(`chars=${chars.join('')} digest=${digest}`)
        buf.add(digest)
    }
}

interface BucketResult {
    skipped: boolean
    value: HighlightedTextProps[]
}

class Bucket {
    constructor(readonly files: SearchValue[], readonly filter: BloomFilter, readonly id: number) {}
    public static fromSearchValues(files: SearchValue[]): Bucket {
        files.sort((a, b) => a.value.length - b.value.length)
        return new Bucket(files, populateBloomFilter(files), Math.random())
    }
    public static fromSerializedString(json: any): Bucket {
        return new Bucket(json.files, new BloomFilter(json.filter, DEFAULT_BLOOM_FILTER_HASH_FUNCTION_COUNT), json.id)
    }
    public serialize(): any {
        return {
            files: this.files,
            filter: [].slice.call(this.filter.buckets),
        }
    }

    private matchesMaybe(hashParts: number[]): boolean {
        return hashParts.every(num => this.filter.test(num))
    }
    public matches(query: string, hashParts: number[]): BucketResult {
        const matchesMaybe = this.matchesMaybe(hashParts)
        if (!matchesMaybe) return { skipped: true, value: [] }
        const result: HighlightedTextProps[] = []
        const queryParts = allFuzzyParts(query)
        for (var i = 0; i < this.files.length; i++) {
            const file = this.files[i]
            const positions = fuzzyMatches(queryParts, file.value)
            if (positions.length > 0) {
                result.push(new HighlightedTextProps(file.value, positions, file.url))
            }
        }
        return { skipped: false, value: result }
    }
}

export interface SearchValue {
    value: string
    url?: string
}

const DEFAULT_BUCKET_SIZE = 500

export class BloomFilterFuzzySearch extends FuzzySearch {
    constructor(readonly buckets: Bucket[], readonly BUCKET_SIZE: number = DEFAULT_BUCKET_SIZE) {
        super()
    }
    public static fromSearchValues(
        files: SearchValue[],
        BUCKET_SIZE: number = DEFAULT_BUCKET_SIZE
    ): BloomFilterFuzzySearch {
        const buckets = []
        let buffer: SearchValue[] = []
        files.forEach(file => {
            buffer.push(file)
            if (buffer.length >= BUCKET_SIZE) {
                buckets.push(Bucket.fromSearchValues(buffer))
                buffer = []
            }
        })
        if (buffer) buckets.push(Bucket.fromSearchValues(buffer))
        return new BloomFilterFuzzySearch(buckets, BUCKET_SIZE)
    }

    public serialize(): any {
        return {
            buckets: this.buckets.map(b => b.serialize()),
            BUCKET_SIZE: this.BUCKET_SIZE,
        }
    }

    public static fromSerializedString(text: string): BloomFilterFuzzySearch {
        const json = JSON.parse(text) as any
        return new BloomFilterFuzzySearch(json.buckets.map(Bucket.fromSerializedString), json.BUCKET_SIZE)
    }

    private actualQuery(query: string): string {
        let end = query.length - 1
        while (end > 0 && isDelimeter(query[end])) end--
        return query.substring(0, end + 1)
    }
    public search(query: FuzzySearchParameters): FuzzySearchResult {
        if (query.value.length === 0) return this.emptyResult(query)
        const self = this
        const result: HighlightedTextProps[] = []
        const finalQuery = this.actualQuery(query.value)
        const hashParts = allQueryHashParts(finalQuery)
        function complete(isComplete: boolean) {
            return self.sorted({ values: result, isComplete: isComplete })
        }
        for (var i = 0; i < this.buckets.length; i++) {
            const bucket = this.buckets[i]
            const matches = bucket.matches(finalQuery, hashParts)
            for (var j = 0; j < matches.value.length; j++) {
                if (result.length >= query.maxResults) {
                    return complete(false)
                }
                result.push(matches.value[j])
            }
        }
        return complete(true)
    }

    private sorted(result: FuzzySearchResult): FuzzySearchResult {
        result.values.sort((a, b) => {
            const byLength = a.text.length - b.text.length
            if (byLength !== 0) return byLength
            const byEarliestMatch = a.offsetSum() - b.offsetSum()
            if (byEarliestMatch !== 0) return byEarliestMatch

            return a.text.localeCompare(b.text)
        })
        return result
    }

    private emptyResult(query: FuzzySearchParameters): FuzzySearchResult {
        const result: HighlightedTextProps[] = []
        const self = this
        function complete(isComplete: boolean) {
            return self.sorted({ values: result, isComplete: isComplete })
        }

        for (var i = 0; i < this.buckets.length; i++) {
            const bucket = this.buckets[i]
            if (result.length > query.maxResults) return complete(false)
            for (var j = 0; j < bucket.files.length; j++) {
                const value = bucket.files[j]
                result.push(new HighlightedTextProps(value.value, [], value.url))
                if (result.length > query.maxResults) return complete(false)
            }
        }
        return complete(true)
    }
}
