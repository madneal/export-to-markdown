# Export to Markdown

A Manifest V3 Chrome extension that converts the active HTTP or HTTPS webpage to Markdown locally in the browser.

## Conversion pipeline

- [Mozilla Readability](https://github.com/mozilla/readability) extracts the page's primary readable content.
- [Turndown](https://github.com/mixmark-io/turndown) converts the extracted HTML to Markdown.
- [Turndown Plugin GFM](https://github.com/mixmark-io/turndown-plugin-gfm) preserves tables, task lists, strikethrough, and fenced code blocks.
- A semantic `article`/`main` fallback handles short pages that Readability intentionally skips.

All conversion code is bundled with the extension. The extension does not fetch a private site API, load remote code, or send page content to a server.

## Install for testing

1. Run `npm ci`.
2. Run `npm run vendor` if the locked third-party dependencies were updated.
3. Open `chrome://extensions` in Chrome and enable **Developer mode**.
4. Click **Load unpacked** and select this repository folder.
5. Open a normal HTTP or HTTPS webpage and click the extension icon.

Chrome does not allow extensions to read protected pages such as `chrome://` pages or the Chrome Web Store.

## Verify

Run the deterministic extraction, conversion, and manifest tests:

```sh
npm test
```

Run the end-to-end suite in an isolated Chrome for Testing profile:

```sh
npx playwright install chromium
npm run test:browser
```

The browser suite invokes the real extension action and verifies rich and short pages, live Chrome and MDN documentation, copy/retry/history behavior, and the protected-page error state.

Build and validate the same ZIP package used by the release workflow:

```sh
npm run package
```

The generated package is `export-to-markdown.zip`.

Chrome Web Store permission justifications and reviewer steps are documented in [CHROME_WEB_STORE.md](CHROME_WEB_STORE.md).

## Permissions

- `activeTab`: temporarily reads the active page only after the user invokes the extension.
- `scripting`: injects the locally bundled Readability extractor into that active page.

The extension requests no permanent host permissions.

## License

[MIT](LICENSE). Third-party notices are listed in [THIRD_PARTY_LICENSES.md](THIRD_PARTY_LICENSES.md).
