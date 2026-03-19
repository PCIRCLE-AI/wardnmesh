#!/bin/bash
# Generate all required Tauri icons from source image
# Usage: ./generate-icons.sh source-logo.png

set -e

SOURCE="${1:-source-logo.png}"

if [ ! -f "$SOURCE" ]; then
    echo "Error: Source file '$SOURCE' not found"
    exit 1
fi

echo "Generating icons from $SOURCE..."

# PNG icons for various sizes
sips -z 32 32 "$SOURCE" --out 32x32.png
sips -z 128 128 "$SOURCE" --out 128x128.png
sips -z 256 256 "$SOURCE" --out 128x128@2x.png
sips -z 512 512 "$SOURCE" --out icon.png

# Windows Store logos
sips -z 30 30 "$SOURCE" --out Square30x30Logo.png
sips -z 44 44 "$SOURCE" --out Square44x44Logo.png
sips -z 71 71 "$SOURCE" --out Square71x71Logo.png
sips -z 89 89 "$SOURCE" --out Square89x89Logo.png
sips -z 107 107 "$SOURCE" --out Square107x107Logo.png
sips -z 142 142 "$SOURCE" --out Square142x142Logo.png
sips -z 150 150 "$SOURCE" --out Square150x150Logo.png
sips -z 284 284 "$SOURCE" --out Square284x284Logo.png
sips -z 310 310 "$SOURCE" --out Square310x310Logo.png
sips -z 50 50 "$SOURCE" --out StoreLogo.png

# Generate .icns for macOS
echo "Generating macOS .icns..."
mkdir -p icon.iconset
sips -z 16 16 "$SOURCE" --out icon.iconset/icon_16x16.png
sips -z 32 32 "$SOURCE" --out icon.iconset/icon_16x16@2x.png
sips -z 32 32 "$SOURCE" --out icon.iconset/icon_32x32.png
sips -z 64 64 "$SOURCE" --out icon.iconset/icon_32x32@2x.png
sips -z 128 128 "$SOURCE" --out icon.iconset/icon_128x128.png
sips -z 256 256 "$SOURCE" --out icon.iconset/icon_128x128@2x.png
sips -z 256 256 "$SOURCE" --out icon.iconset/icon_256x256.png
sips -z 512 512 "$SOURCE" --out icon.iconset/icon_256x256@2x.png
sips -z 512 512 "$SOURCE" --out icon.iconset/icon_512x512.png
sips -z 1024 1024 "$SOURCE" --out icon.iconset/icon_512x512@2x.png
iconutil -c icns icon.iconset -o icon.icns
rm -rf icon.iconset

# Generate .ico for Windows (requires ImageMagick or we use a simple approach)
echo "Generating Windows .ico..."
if command -v convert &> /dev/null; then
    convert "$SOURCE" -define icon:auto-resize=256,128,64,48,32,16 icon.ico
else
    echo "Warning: ImageMagick not found. Using sips fallback for .ico"
    # Create a 256x256 PNG as fallback (Windows can use PNG in ico container)
    sips -z 256 256 "$SOURCE" --out icon.ico
fi

echo "Done! Generated all icons."
ls -la *.png *.icns *.ico
