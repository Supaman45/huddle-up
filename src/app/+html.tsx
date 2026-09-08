import { ScrollViewStyleReset } from 'expo-router/html';
import type { PropsWithChildren } from 'react';

/**
 * The HTML shell around every statically exported page.
 *
 * This exists for one reason: a parent adds the site to their home screen and it has to come
 * back looking like an app, not like a browser bookmark. iOS Safari ignores the web manifest
 * for the home-screen icon and the launch name, so both are declared the Apple way as well.
 * The two sets say the same thing on purpose.
 *
 * The dark background is set here rather than in a component, because the browser paints the
 * page before any React renders. Without it a parent gets a white flash on every launch.
 */
const background = `
  html, body { background-color: #0F1620; }
  body { overscroll-behavior-y: none; }
`;

export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        {/* viewport-fit=cover is what gives the standalone app real safe-area insets on a
            notched iPhone. Without it the tab bar sits under the home indicator. */}
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no, viewport-fit=cover" />

        <title>Huddle Up</title>
        <meta name="description" content="Schedules, RSVPs and carpools for your kid's team. Free for the whole team." />

        {/* Android and Chrome read this. */}
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#0F1620" />
        <meta name="mobile-web-app-capable" content="yes" />

        {/* iOS Safari reads these instead, and only these. The title is the label under the
            icon, and it is capped at about twelve characters before it truncates. */}
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-title" content="Huddle Up" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />

        <link rel="icon" href="/favicon.png" type="image/png" />

        <ScrollViewStyleReset />
        <style dangerouslySetInnerHTML={{ __html: background }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
