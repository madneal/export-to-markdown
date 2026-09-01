# Chrome Web Store Submission Notes

## Single purpose

Export to Markdown converts the active HTTP or HTTPS webpage into Markdown in the extension popup. Conversion happens locally in Chrome.

## Permission justifications

### activeTab

The extension temporarily reads only the active webpage after the user clicks the extension action. It does not read background tabs or retain access after the user leaves the page.

### scripting

The extension injects its locally bundled Mozilla Readability library and extraction script into the active tab. The script extracts the page's readable content and returns it to the popup for local Markdown conversion.

## Remote code

The extension does not use remote code. Mozilla Readability, Turndown, and Turndown Plugin GFM are included in the submitted package. No JavaScript is loaded from a CDN or external server.

## Reviewer test instructions

No account, payment, or special credentials are required.

1. In Chrome, open https://developer.chrome.com/docs/extensions/develop/migrate/what-is-mv3
2. Click the Export to Markdown extension icon.
3. Wait for the green conversion status. The Markdown field should begin with the page title and contain headings, paragraphs, links, lists, and code from the page.
4. Click **Copy Markdown** and paste into any text field to confirm the generated Markdown was copied.
5. Click **Convert current page** to confirm that a manual retry produces the same output.

Chrome blocks all extensions from reading protected pages such as `chrome://` pages and the Chrome Web Store itself. Test the extension on a normal HTTP or HTTPS webpage.
