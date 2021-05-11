import { useState } from 'react'
export type Dispatch<A> = (value: A) => void

export interface State<T> {
    value: T
    set(newValue: T): void
}

export function useEphemeralState<T>(initialValue: T): State<T> {
    const [value, set] = useState(initialValue)
    return {
        value: value,
        set: set,
    }
}
export function useLocalStorage<T>(key: string, initialValue: T): State<T> {
    const [storedValue, setStoredValue] = useState(() => {
        try {
            const item = window.localStorage.getItem(key)
            return item ? JSON.parse(item) : initialValue
        } catch (error) {
            console.log(error)
            return initialValue
        }
    })

    const setValue = (value: T) => {
        try {
            const valueToStore = value instanceof Function ? value(storedValue) : value
            setStoredValue(valueToStore)
            window.localStorage.setItem(key, JSON.stringify(valueToStore))
        } catch (error) {
            console.log(error)
        }
    }

    return {
        value: storedValue,
        set: setValue,
    }
}
