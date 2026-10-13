const META_DESCRIPTION = 'Local experiences by local banDits';
const SITE_URL = 'https://bandits-two.vercel.app';
const OG_IMAGE_URL = `${SITE_URL}/icon-512.png`;
const OG_TITLE = 'bandiTour';

/**
 * Web shell styles — intentionally NOT using expo-router ScrollViewStyleReset.
 * That reset sets `body { overflow: hidden }`, which removes the native scrollbar.
 * App chrome (header + bottom nav) stays viewport-sized; page ScrollViews scroll.
 */
export default function Root({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, shrink-to-fit=no, viewport-fit=cover"
        />
        <title>{OG_TITLE}</title>
        <meta name="description" content={META_DESCRIPTION} />
        <meta name="title" content={OG_TITLE} />

        <meta property="og:type" content="website" />
        <meta property="og:site_name" content={OG_TITLE} />
        <meta property="og:url" content={`${SITE_URL}/hotel/play-theatrou`} />
        <meta property="og:title" content={OG_TITLE} />
        <meta property="og:description" content={META_DESCRIPTION} />
        <meta property="og:image" content={OG_IMAGE_URL} />
        <meta property="og:image:secure_url" content={OG_IMAGE_URL} />
        <meta property="og:image:type" content="image/png" />
        <meta property="og:image:width" content="512" />
        <meta property="og:image:height" content="512" />

        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={OG_TITLE} />
        <meta name="twitter:description" content={META_DESCRIPTION} />
        <meta name="twitter:image" content={OG_IMAGE_URL} />

        <style
          dangerouslySetInnerHTML={{
            __html: `
          html, body {
            height: 100%;
            margin: 0;
            background-color: #0a0a0a;
            overscroll-behavior-y: auto;
            -webkit-overflow-scrolling: touch;
          }
          /* No overflow:hidden on html/body/#root — native scrollbars must remain visible */
          #root {
            display: flex;
            flex-direction: column;
            height: 100%;
            min-height: 100%;
            min-height: 100dvh;
            background-color: #0a0a0a;
          }
          /* Override RN-web hideScrollbar (scrollbarWidth: none); never hide scrollbars globally */
          * {
            scrollbar-width: auto !important;
          }
          ::-webkit-scrollbar {
            width: 10px;
            height: 10px;
          }
          ::-webkit-scrollbar-thumb {
            background-color: rgba(0, 0, 0, 0.35);
            border-radius: 8px;
          }
        `,
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}

