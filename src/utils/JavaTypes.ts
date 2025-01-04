export interface Comparable<T> {
    compare(other: T): -1 | 0 | 1
}

export interface Comparator<T> {
    compare(t1: T, t2: T): -1 | 0 | 1
}