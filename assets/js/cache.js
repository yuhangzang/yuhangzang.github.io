// Cache failures must never prevent navigation, search, or rendering.
export const sessionCache = {
    get(key, maxAge) {
        try {
            const entry = JSON.parse(sessionStorage.getItem(key));
            if (entry && typeof entry.timestamp === 'number' && Date.now() - entry.timestamp < maxAge) {
                return entry.value;
            }
            sessionStorage.removeItem(key);
        } catch { /* Storage may be blocked or contain invalid JSON. */ }
        return null;
    },
    set(key, value) {
        try { sessionStorage.setItem(key, JSON.stringify({ value, timestamp: Date.now() })); }
        catch { /* Quota and private browsing failures are non-fatal. */ }
    }
};
