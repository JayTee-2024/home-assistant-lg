# Artwork

`icon.svg` is the source of the app icon: a house outline with a cog, in the app's amber on its dark
background. The TV uses two PNG copies in `webos/`, at the sizes LG asks for:

- `webos/icon.png`, 80 × 80
- `webos/largeIcon.png`, 130 × 130 (also shown by Homebrew Channel)

After changing the SVG, make the PNGs again. With [librsvg](https://wiki.gnome.org/Projects/LibRsvg)
installed:

```
rsvg-convert -w 80 -h 80 art/icon.svg -o webos/icon.png
rsvg-convert -w 130 -h 130 art/icon.svg -o webos/largeIcon.png
```

Any SVG editor or converter that exports PNG at those sizes works as well.
