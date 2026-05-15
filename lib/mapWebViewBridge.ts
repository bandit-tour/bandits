/** Safe inject helpers for Leaflet WebView bridge (Explore map). */

export function injectMapCatalog(webView: { injectJavaScript: (s: string) => void } | null, payloadJson: string): void {
  webView?.injectJavaScript(
    `(function(){if(typeof window.__setMapCatalog==='function'){window.__setMapCatalog(${payloadJson});}true;})();`,
  );
}

export function injectMapSelection(
  webView: { injectJavaScript: (s: string) => void } | null,
  eventId: string,
): void {
  const safeId = JSON.stringify(String(eventId));
  webView?.injectJavaScript(
    `(function(){if(typeof window.__setMapSelection==='function'){window.__setMapSelection(${safeId});}true;})();`,
  );
}
