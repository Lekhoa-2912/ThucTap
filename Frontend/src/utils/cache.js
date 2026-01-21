/**
 * Simple Cache Utility for API responses
 * Supports TTL (Time To Live) and memory caching
 */

class CacheManager {
    constructor() {
        this.cache = new Map()
        this.defaultTTL = 5 * 60 * 1000 // 5 minutes default
    }

    /**
     * Generate cache key from URL and params
     */
    generateKey(url, params = {}) {
        const paramString = Object.keys(params)
            .sort()
            .filter(key => params[key] !== undefined && params[key] !== null)
            .map(key => `${key}=${params[key]}`)
            .join('&')
        return paramString ? `${url}?${paramString}` : url
    }

    /**
     * Get cached data if valid
     */
    get(key) {
        const cached = this.cache.get(key)
        if (!cached) return null

        // Check if expired
        if (Date.now() > cached.expiry) {
            this.cache.delete(key)
            return null
        }

        return cached.data
    }

    /**
     * Set cache with TTL
     */
    set(key, data, ttl = this.defaultTTL) {
        this.cache.set(key, {
            data,
            expiry: Date.now() + ttl
        })
    }

    /**
     * Invalidate specific cache
     */
    invalidate(key) {
        this.cache.delete(key)
    }

    /**
     * Invalidate all caches matching a pattern
     */
    invalidatePattern(pattern) {
        for (const key of this.cache.keys()) {
            if (key.includes(pattern)) {
                this.cache.delete(key)
            }
        }
    }

    /**
     * Clear all cache
     */
    clear() {
        this.cache.clear()
    }

    /**
     * Get cache stats
     */
    getStats() {
        let valid = 0
        let expired = 0
        const now = Date.now()

        for (const [, value] of this.cache) {
            if (now > value.expiry) {
                expired++
            } else {
                valid++
            }
        }

        return { total: this.cache.size, valid, expired }
    }
}

// Singleton instance
export const cacheManager = new CacheManager()

// Cache TTL presets (in milliseconds)
export const CACHE_TTL = {
    SHORT: 30 * 1000,        // 30 seconds - for frequently changing data
    MEDIUM: 2 * 60 * 1000,   // 2 minutes - for moderately changing data
    LONG: 10 * 60 * 1000,    // 10 minutes - for rarely changing data
    VERY_LONG: 30 * 60 * 1000 // 30 minutes - for static data
}

/**
 * Cached API wrapper
 * Wraps an API call with caching
 */
export const cachedRequest = async (apiCall, cacheKey, ttl = CACHE_TTL.MEDIUM) => {
    // Check cache first
    const cached = cacheManager.get(cacheKey)
    if (cached) {
        console.log(`[Cache] HIT: ${cacheKey}`)
        return cached
    }

    // Cache miss - make API call
    console.log(`[Cache] MISS: ${cacheKey}`)
    const response = await apiCall()

    // Cache the response data
    cacheManager.set(cacheKey, response, ttl)

    return response
}

export default cacheManager
