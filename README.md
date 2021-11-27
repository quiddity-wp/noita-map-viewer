## About

Noita Map Viewer is a fast, fully-responsive, [Leaflet](https://leafletjs.com)-based map viewer for the videogame [Noita](https://noitagame.com). It makes use of the Leaflet plugins [MiniMap](https://github.com/Norkart/Leaflet-MiniMap), [DeepZoom](https://github.com/alfarisi/leaflet-deepzoom) and [Mouse Position](https://github.com/ardhi/Leaflet.MousePosition) to provide a viewing experience that is on par with, if not superior to the one that is offered by EasyZoom. A demo of this viewer is available [here](https://noita.datahoarder.dev).

### FAQ
#### Why?
1. I'm a self-hosting enthusiast, which means that I don't like to be at the mercy of third-party services like EasyZoom when I have the option to host a similar service myself.
2. Updating the map on EasyZoom after a Noita update takes hours every time because you have to recreate the map markers.
3. EasyZoom's viewer is incredibly slow compared to Leaflet+DeepZoom, likely because they use an IIIF server like [Cantaloupe](https://cantaloupe-project.github.io) or [IIPImage Server](https://iipimage.sourceforge.io) to seamlessly stream the image tiles from a PNG/TIFF file.
4. You can't use EasyZoom's map viewer without an Internet connection.

#### How can I use this map viewer offline?
1. Download this repository ([*click*](https://github.com/whalehub/noita-map-viewer/archive/refs/heads/master.zip)) and extract it.
2. Download the Noita map file ([*click*](https://mega.nz/file/HnxAHKbb#L3dTuPTTQ2VxGSewLomTq9EgrJfdabJbL-WQ1C7WYKk)) [Mirrors: [1](https://www.mediafire.com/file/8tu0pj1gopvg0mm/noita.zip/file), [2](https://noita.datahoarder.dev/deepzoom/noita.zip), [torrent](https://noita.datahoarder.dev/deepzoom/noita.torrent)] and extract it inside the `deepzoom` folder.
3. Done! You can now view the map by opening the `index.html` file in a browser of your choice.

#### Can I host my own copy of this map viewer?
Yes! The viewer is a static HTML page, so you can simply drop the files in your webserver's root directory and start using it.

#### How can I use my own map with this viewer?
1. Create a PNG image of your map by following the steps in the [Noita MapCapture addon](https://github.com/Dadido3/noita-mapcap) repository.
2. Download the commandline tool `vips` from its [release page](https://github.com/libvips/libvips/releases) and install it.
3. Open a commandline prompt and convert your PNG image to the DeepZoom format using the command
```
vips dzsave output.png noita
```
4. Place the `noita_files` folder and `noita.dzi` file in the `deepzoom` folder of this viewer.
5. Done! You can now view your own map by opening the `index.html` file in a browser of your choice.

#### How can I edit/add/remove map markers?
The map marker locations and their descriptions are defined [here](https://github.com/whalehub/noita-map-viewer/blob/master/js/scripts.js#L525-L628) and [here](https://github.com/whalehub/noita-map-viewer/blob/master/js/scripts.js#L630-L733) respectively.

#### How can I contribute to this project?
If you see anything on the map that should be marked but isn't, that has an incorrect description or could simply use a better description, feel free to open an issue or a pull request with the required details (map coordinates, description, etc.).

#### Credits
A big shout out goes to [veediagaems](https://www.twitch.tv/veediagaems) for creating the markers that I adapted from his [EasyZoom map](https://www.easyzoom.com/image/260463).
