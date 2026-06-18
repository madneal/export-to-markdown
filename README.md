# Export to Markdown

A Chrome extension for exporting articles from supported blog websites to Markdown text. Suggestions are welcome.

## Supported websites
* https://medium.com
* https://elastic.co/blog

## Sample image
![demo](https://user-images.githubusercontent.com/12164075/26960726-fc486212-4d0b-11e7-9f59-1cb738db9e4e.gif)

## Install
* Install it from the [Chrome Web Store](https://chrome.google.com/webstore/detail/export-to-markdown/dodkihcbgpjblncjahodbnlgkkflliim?utm_source=chrome-ntp-icon&authuser=1).
* Or install it manually:

  1. Open `chrome://extensions` in Chrome, and enable developer mode.
  2. Click `Load unpacked`, and select the `export-to-markdown` project folder.
  
## Build
This repository does not currently include a build script. To test local changes, load the project folder as an unpacked Chrome extension.

## Changelog
### v0.3.0
* migrate the extension manifest to Manifest V3

### v0.2.0
* update the extension version in `manifest.json`

### v0.1.7
* enable export after clicking the extension icon
* enable copy-to-clipboard indication

### v0.1.6
* support for [elastic blog](https://www.elastic.co/blog)
* enable error message display

### v0.1.5
* enable to delete history

### v0.1.4
* modify style of popup page
* add export history by default

### v0.1.1
* export the story to a markdown format text
* just click a button, you can copy the markdown to your clipboard

## LICENSE

[MIT](LICENSE)
