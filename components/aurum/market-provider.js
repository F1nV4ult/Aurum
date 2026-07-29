/**
 * Aurum — provider adapter boundary.
 *
 * Yahoo remains the sole live public source. A validated browser cache is the
 * only secondary source: it reduces rate-limit pressure and preserves a clear,
 * provenance-labelled degraded mode instead of silently substituting data.
 */

export async function fetchWithProviderFallback(primary, fallback, request) {
  try {
    const value = await primary.fetch(request);
    return { value, provider: primary.name, usedFallback: false, primaryError: null };
  } catch (primaryError) {
    if (!fallback) throw primaryError;
    try {
      const value = await fallback.fetch(request, primaryError);
      if (!value) throw new Error('Fallback returned no data.');
      return { value, provider: fallback.name, usedFallback: true, primaryError };
    } catch (fallbackError) {
      throw new Error(`${primary.name} unavailable (${primaryError.message}); ${fallback.name} unavailable (${fallbackError.message}).`);
    }
  }
}
