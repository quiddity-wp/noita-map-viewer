## About

Noita Map Viewer is a fast, fully-responsive, [Leaflet](https://leafletjs.com)-based map viewer for the videogame [Noita](https://noitagame.com). It makes use of the Leaflet plugins [Leaflet-MiniMap](https://github.com/Norkart/Leaflet-MiniMap), [Leaflet-IIIF](https://github.com/mejackreed/Leaflet-IIIF) and [Leaflet-MousePosition](https://github.com/ardhi/Leaflet.MousePosition) to provide a viewing experience that is on par with, if not superior to the one that is offered by EasyZoom. A demo of this viewer is available [here](https://noita.datahoarder.dev).

### FAQ
#### Why?
1. I'm a self-hosting enthusiast, which means that I don't like to be at the mercy of third-party services like EasyZoom when I have the option to host a similar service myself.
2. Updating the map on EasyZoom after a Noita update takes hours every time because you have to recreate the map markers.
3. EasyZoom's viewer is quite slow compared to Leaflet+IIIFv3, possibly because they use a server application like [Cantaloupe](https://cantaloupe-project.github.io) or [IIPImage Server](https://iipimage.sourceforge.io) to extract image tiles from a PNG/TIFF file on-the-fly.
4. You can't use EasyZoom's map viewer without an Internet connection.

#### How can I use this map viewer offline?
1. Download `noita-map-viewer.exe` [here](https://mega.nz/file/zngFhCKA#5p4BkaAwQYlhEJN_OLe_onSYW_jCA1RO4WlpDq92ROo). [Mirrors: [1](https://www.mediafire.com/file/5e95tcrfc3kk144/noita-map-viewer.exe/file), [2](https://noita.datahoarder.dev/github/noita-map-viewer.exe), [torrent](https://noita.datahoarder.dev/github/noita-map-viewer.torrent)]
2. Run the executable file.
3. Done! You can now view the map by visiting the URL `http://127.0.0.1:8080` in a browser.

**Note:** You can inspect the contents of `noita-map-viewer.exe` with a file archival utility like [7-Zip](https://www.7-zip.org). Under the hood, it's essentially just a `.zip` file that contains static HTML assets and the tool [redbean](https://redbean.dev) to serve them.

#### Can I host my own copy of this map viewer?
Yes! The viewer is a static HTML page, so you can simply drop the files in your webserver's root directory and start using it.

#### How can I use my own map with this viewer?
1. Download this repository ([*click*](https://github.com/whalehub/noita-map-viewer/archive/refs/heads/master.zip)), extract the `.zip` file and rename the extracted folder to `noita-map-viewer`.
2. Create a PNG image of your map by following the steps that are outlined in the [Noita MapCapture addon](https://github.com/Dadido3/noita-mapcap) repository.
3. Download the commandline tool `vips` from its [release page](https://github.com/libvips/libvips/releases) and install it by placing it in your `PATH`.
4. Open a commandline prompt and use the following command to convert your PNG image to the IIIFv3 format:
```
vips dzsave --layout iiif3 --tile-size 256 output.png iiif3
```
5. Move the newly created `iiif3` folder inside the `noita-map-viewer` folder.
6. Serve the `noita-map-viewer` folder with a webserver\* of your choice.
7. Done! You can now view your own map by visiting your webserver's URL in a browser.

\*If you plan on sharing your map with other people, I'd recommend serving the folder with either [Nginx](https://github.com/nginx/nginx) or [Caddy](https://github.com/caddyserver/caddy). If not, I'd recommend using a minimalistic webserver like [devd](https://github.com/cortesi/devd), [nimhttpd](https://github.com/h3rald/nimhttpd) or [webby](https://github.com/ssddanbrown/webby) instead.

#### How can I edit/add/remove map markers?
The map marker locations and their descriptions are defined [here](https://github.com/whalehub/noita-map-viewer/blob/master/js/scripts.js#L744-L849) and [here](https://github.com/whalehub/noita-map-viewer/blob/master/js/scripts.js#L851-L956) respectively.

#### How can I contribute to this project?
If you see anything on the map that should be marked but isn't, that has an incorrect description or could simply use a better description, feel free to open an issue or a pull request with the required details (map coordinates, description, etc.).

#### Credits
A big shout out goes to [veediagaems](https://www.twitch.tv/veediagaems) for creating the markers that I adapted from his [EasyZoom map](https://www.easyzoom.com/image/260463).
