## About

Noita Map Viewer is a fast, fully-responsive, [Leaflet](https://leafletjs.com)-based map viewer for the videogame [Noita](https://noitagame.com). It makes use of the Leaflet plugins [Leaflet-MiniMap](https://github.com/Norkart/Leaflet-MiniMap), [Leaflet-IIIF](https://github.com/mejackreed/Leaflet-IIIF) and [Leaflet-MousePosition](https://github.com/ardhi/Leaflet.MousePosition) to provide a viewing experience that is on par with, if not superior to the one that is offered by EasyZoom. A demo of this viewer is available [here](https://noita.datahoarder.dev).

### FAQ
#### Why?
1. I'm a self-hosting enthusiast, which means that I don't like to be at the mercy of third-party services like EasyZoom when I have the option to host a similar service myself.
2. Updating the map on EasyZoom after a Noita update takes hours every time because you have to recreate the map markers.
3. EasyZoom's viewer is quite slow compared to Leaflet+IIIFv3, possibly because they use a server application like [Cantaloupe](https://cantaloupe-project.github.io) or [IIPImage Server](https://iipimage.sourceforge.io) to extract image tiles from a PNG/TIFF file on-the-fly.
4. You can't use EasyZoom's map viewer without an Internet connection.

#### How can I use this map viewer offline?
1. Download this repository ([*click*](https://github.com/whalehub/noita-map-viewer/archive/refs/heads/master.zip)), extract the `.zip` file and rename the extracted folder to `noita-map-viewer`.
2. Download the IIIFv3 image layout ([*click*](https://mega.nz/file/b2RVWaaT#0dr1BuQZBVngTat4DA2ko6IClHQe4-Q9UAS3gztAXvk)) [Mirrors: [1](https://www.mediafire.com/file/yssqtcan290q1e6/noita.zip/file), [2](https://noita.datahoarder.dev/iiif3/noita.zip), [torrent](https://noita.datahoarder.dev/iiif3/noita.torrent)] and extract the `.zip` file inside the `noita-map-viewer` folder.
3. Done! You can now view the map by opening the `index.html` file in a browser of your choice.

#### Can I host my own copy of this map viewer?
Yes! The viewer is a static HTML page, so you can simply drop the files in your webserver's root directory and start using it.

#### How can I use my own map with this viewer?
1. Create a PNG image of your map by following the steps in the [Noita MapCapture addon](https://github.com/Dadido3/noita-mapcap) repository.
2. Download the commandline tool `vips` from its [release page](https://github.com/libvips/libvips/releases) and install it by placing it in your `PATH`.
3. Open a commandline prompt and convert your PNG image to the IIIFv3 format using the command
```
vips dzsave --layout iiif3 --tile-size 256 output.png iiif3
```
4. Move the newly created `iiif3` folder inside the `noita-map-viewer` folder.
5. Done! You can now view your own map by opening the `index.html` file in a browser of your choice.

#### How can I edit/add/remove map markers?
The map marker locations and their descriptions are defined [here](https://github.com/whalehub/noita-map-viewer/blob/master/js/scripts.js#L744-L847) and [here](https://github.com/whalehub/noita-map-viewer/blob/master/js/scripts.js#L849-L952) respectively.

#### How can I contribute to this project?
If you see anything on the map that should be marked but isn't, that has an incorrect description or could simply use a better description, feel free to open an issue or a pull request with the required details (map coordinates, description, etc.).

#### Credits
A big shout out goes to [veediagaems](https://www.twitch.tv/veediagaems) for creating the markers that I adapted from his [EasyZoom map](https://www.easyzoom.com/image/260463).
