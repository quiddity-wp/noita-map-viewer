## About

Noita Map Viewer is a fast, fully-responsive, [OpenSeadragon](https://openseadragon.github.io)-based map viewer for the videogame [Noita](https://noitagame.com). It offers a viewing experience that is on par with, if not superior to the one that is offered by EasyZoom. A [demo of this viewer is available here](https://noita.datahoarder.dev).

### FAQ
#### Why?
1. I'm a self-hosting enthusiast, which means that I don't like to be at the mercy of third-party services like EasyZoom when I have the option to host a similar service myself.
2. Updating the map on EasyZoom after a Noita update takes hours every time because you have to recreate the map markers.
3. EasyZoom's viewer is quite slow compared to OpenSeadragon+IIIFv3, possibly because they use a server application like [Cantaloupe](https://cantaloupe-project.github.io) or [IIPImage Server](https://iipimage.sourceforge.io) to extract image tiles from a PNG/TIFF file on-the-fly.
4. You can't use EasyZoom's map viewer without an Internet connection.

#### How can I use this map viewer offline?
#TODO

#### Can I host my own copy of this map viewer?
Yes! The viewer is a static HTML page, so you can simply drop the files in your webserver's root directory and start using it.

#### How can I use my own map with this viewer?
#TODO

#### How can I edit/add/remove map markers?
#TODO

#### How can I contribute to this project?
If you see anything on the map that should be marked but isn't, that has an incorrect description or could simply use a better description, feel free to open an issue or a pull request with the required details (map coordinates, description, etc.).

#### Credits
A big shout out goes to [veediagaems](https://www.twitch.tv/veediagaems) for creating the markers that I adapted from his [EasyZoom map](https://www.easyzoom.com/image/260463).
