# export-to-markdown 
A Chrome extension to export the story in Medium to a markdown format file. And the chrome extension is going to support to obtain markdown text for more blog websites. Any suggestion is welcome.

## Supported websites
* https://medium.com
* https://elastic.co/blog

## Sample image
![deyunde](https://user-images.githubusercontent.com/12164075/26960726-fc486212-4d0b-11e7-9f59-1cb738db9e4e.gif)

## Install
* You can go to the [Web Store](https://chrome.google.com/webstore/detail/export-to-markdown/dodkihcbgpjblncjahodbnlgkkflliim?utm_source=chrome-ntp-icon&authuser=1) to install.
* Or you can install it manunally:

  1. Open `chrome://extensions` in Chrome, and enable developer mode.
  2. Click 'load unzip extension' button, and select the `export-medium` file folder.
  
## Build
Run ` python build.py` to generate the zip file

## Changelog
### v0.1.7
* enable to export after clike the icon of the extension
* enable copy to clipboard indication

### v0.1.6
* support for [elastic blog](https://www.elastic.co/blog)
* enable error information display

### v0.1.5
* enable to delete history

### v0.1.4
* modify style of popup page
* add export history by default

### v0.1.1
* export the story to a markdown format text
* just click a button, you can copy the markdown to your clipboard

## LICENSE

[MIT](https://github.com/neal1991/export-medium/blob/master/LICENSE)
