import { ScrollViewStyleReset } from 'expo-router/html';

const META_DESCRIPTION = 'Local experiences by local banDits';
const SITE_URL = 'https://bandits-two.vercel.app';
const OG_IMAGE_URL = `${SITE_URL}/icon-512.png`;
const OG_TITLE = 'bandiTour';

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

        <ScrollViewStyleReset />
        <style
          dangerouslySetInnerHTML={{
            __html: `
          html, body { background-color: #0a0a0a; overscroll-behavior-y: auto; -webkit-overflow-scrolling: touch; }
          #root { min-height: 100vh; min-height: 100dvh; background-color: #0a0a0a; }
        `,
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}

