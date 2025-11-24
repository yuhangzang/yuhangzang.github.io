#!/bin/bash
# Generate favicon PNG files from SVG
# Requires: ImageMagick (brew install imagemagick) or rsvg-convert (brew install librsvg)

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
IMGS_DIR="$PROJECT_DIR/imgs"
SVG_FILE="$IMGS_DIR/favicon.svg"

echo "Generating favicon PNG files..."

# Check for available tools
if command -v convert &> /dev/null; then
    echo "Using ImageMagick..."
    convert -background none -resize 16x16 "$SVG_FILE" "$IMGS_DIR/favicon-16x16.png"
    convert -background none -resize 32x32 "$SVG_FILE" "$IMGS_DIR/favicon-32x32.png"
    convert -background none -resize 180x180 "$SVG_FILE" "$IMGS_DIR/apple-touch-icon.png"
    convert -background none -resize 192x192 "$SVG_FILE" "$IMGS_DIR/android-chrome-192x192.png"
    convert -background none -resize 512x512 "$SVG_FILE" "$IMGS_DIR/android-chrome-512x512.png"
elif command -v rsvg-convert &> /dev/null; then
    echo "Using rsvg-convert..."
    rsvg-convert -w 16 -h 16 "$SVG_FILE" -o "$IMGS_DIR/favicon-16x16.png"
    rsvg-convert -w 32 -h 32 "$SVG_FILE" -o "$IMGS_DIR/favicon-32x32.png"
    rsvg-convert -w 180 -h 180 "$SVG_FILE" -o "$IMGS_DIR/apple-touch-icon.png"
    rsvg-convert -w 192 -h 192 "$SVG_FILE" -o "$IMGS_DIR/android-chrome-192x192.png"
    rsvg-convert -w 512 -h 512 "$SVG_FILE" -o "$IMGS_DIR/android-chrome-512x512.png"
else
    echo "Error: No suitable tool found."
    echo "Please install ImageMagick: brew install imagemagick"
    echo "Or install librsvg: brew install librsvg"
    exit 1
fi

echo "Favicon files generated successfully!"
echo "Generated files:"
ls -la "$IMGS_DIR"/favicon-*.png "$IMGS_DIR"/apple-touch-icon.png "$IMGS_DIR"/android-chrome-*.png 2>/dev/null
