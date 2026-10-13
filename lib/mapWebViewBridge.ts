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

/** Single inject avoids Android races between catalog and selection. */
export function injectMapSync(
  webView: { injectJavaScript: (s: string) => void } | null,
  payloadJson: string,
  eventId: string | null,
): void {
  const selectionJs = eventId
    ? `if(typeof window.__setMapSelectionQuiet==='function'){window.__setMapSelectionQuiet(${JSON.stringify(String(eventId))});}`
    : '';
  webView?.injectJavaScript(
    `(function(){
      if(typeof window.__setMapCatalog==='function'){window.__setMapCatalog(${payloadJson});}
      ${selectionJs}
      true;
    })();`,
  );
}

export function injectMapInvalidateSize(
  webView: { injectJavaScript: (s: string) => void } | null,
): void {
  webView?.injectJavaScript(
    `(function(){if(typeof window.__invalidateMapSize==='function'){window.__invalidateMapSize();}true;})();`,
  );
}

export function injectMapFitCatalog(
  webView: { injectJavaScript: (s: string) => void } | null,
): void {
  webView?.injectJavaScript(
    `(function(){if(typeof window.__fitCatalog==='function'){window.__fitCatalog();}true;})();`,
  );
}
