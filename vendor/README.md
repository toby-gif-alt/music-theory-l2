# Vendor Directory

This directory is for self-hosting third-party libraries.

## VexFlow

To self-host VexFlow (optional but recommended to avoid CDN issues):

1. Download VexFlow 3.0.9:
   ```bash
   curl -L -o vendor/vexflow-debug.js https://unpkg.com/vexflow@3.0.9/build/cjs/vexflow-debug.js
   ```

2. Update the script source in `index.html` from:
   ```html
   <script src="https://unpkg.com/vexflow@3.0.9/build/cjs/vexflow-debug.js" defer></script>
   ```
   
   to:
   ```html
   <script src="/vendor/vexflow-debug.js" defer></script>
   ```

This avoids any CORB (Cross-Origin Read Blocking) or CSP (Content Security Policy) issues with external CDNs.
