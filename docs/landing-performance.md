# Landing performance

## Loading strategy

The public landing keeps its initial render independent from heavy or third-party resources:

- The Valeria avatar first renders a 512 px WebP poster. Its optimized 480 px MP4 animation is attached after the demo is visible and the initial render has settled.
- The animation stays static when the visitor requests reduced motion, enables data saving, or uses a 2G connection. It pauses while the demo is outside the viewport.
- YouTube initially renders a local WebP thumbnail and play button. The `youtube-nocookie.com` iframe is created only after the visitor clicks Play.
- Cloudflare Turnstile and the country selector load only when the contact section approaches the viewport or receives interaction.
- The public plans request starts when the plans section approaches the viewport. The localized static catalog remains the immediate fallback.
- Profile, widget, legal and not-found pages use route-level JavaScript chunks instead of being included in the landing entry bundle.

## Performance budgets

Run after a production build:

```bash
npm run build
npm run check:performance
```

The deployment workflow runs the same check before uploading to S3. Current hard limits are:

- Initial JavaScript: 100 KiB gzip.
- Initial CSS: 20 KiB gzip.
- Logo: 10 KiB.
- Avatar poster: 80 KiB.
- Avatar thumbnail: 10 KiB.
- Avatar animation: 350 KiB.
- YouTube placeholder: 80 KiB.

If a budget fails, optimize or defer the resource rather than raising the limit without a new Lighthouse comparison.

## Validation

Use a production build for Lighthouse and test both mobile and desktop. Verify at minimum:

- The landing renders before YouTube and Turnstile are requested.
- Clicking the video placeholder creates the real YouTube player and starts playback.
- Scrolling to Contact loads the complete country selector and, in production, Turnstile.
- The animated avatar falls back to its poster when motion or data saving is enabled.
- `/privacy`, `/terms`, a public profile and widget mode still load their route chunks.
