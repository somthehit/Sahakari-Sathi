/**
 * Safe Error Message Extractor
 * Prevents React Minified Error #31 (Objects are not valid as a React child)
 * by safely resolving any error object, Axios response, Supabase error, or string
 * into a human-readable string message.
 */

export function extractErrorMessage(err: unknown, fallback = 'An unexpected error occurred'): string {
  if (!err) return fallback;
  if (typeof err === 'string') return err.trim() || fallback;

  if (typeof err === 'object') {
    const e = err as any;

    // Axios response data errors
    if (typeof e.response?.data?.error === 'string') return e.response.data.error;
    if (typeof e.response?.data?.error?.message === 'string') return e.response.data.error.message;
    if (typeof e.response?.data?.message === 'string') return e.response.data.message;
    if (Array.isArray(e.response?.data?.details) && e.response.data.details.length > 0) {
      const first = e.response.data.details[0];
      if (typeof first === 'string') return first;
      if (typeof first?.message === 'string') return first.message;
    }

    // Standard Error or Supabase AuthError / PostgrestError
    if (typeof e.message === 'string' && e.message.trim()) return e.message;
    if (typeof e.error_description === 'string' && e.error_description.trim()) return e.error_description;
    if (typeof e.error === 'string' && e.error.trim()) return e.error;
    if (typeof e.error?.message === 'string' && e.error.message.trim()) return e.error.message;
    if (typeof e.statusText === 'string' && e.statusText.trim()) return e.statusText;

    // Validation / Zod issues
    if (Array.isArray(e.issues) && e.issues.length > 0 && typeof e.issues[0]?.message === 'string') {
      return e.issues[0].message;
    }

    // If it's an object with { code, message }
    if (e.code && e.message) {
      return typeof e.message === 'string' ? e.message : `${e.code}: ${JSON.stringify(e.message)}`;
    }

    // Try JSON representation if it has meaningful properties
    try {
      const keys = Object.keys(e);
      if (keys.length > 0) {
        const str = JSON.stringify(e);
        if (str && str !== '{}') return str;
      }
    } catch {
      // ignore serialization error
    }
  }

  return fallback;
}
