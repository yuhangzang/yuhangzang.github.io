#!/bin/bash
# Optimize and compress images for web
# Requires: ImageMagick, cwebp (from libwebp), or optipng/jpegoptim

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
IMGS_DIR="$PROJECT_DIR/imgs"

echo "Image Optimization Script"
echo "========================="
echo ""

# Check available tools
check_tool() {
    if command -v "$1" &> /dev/null; then
        echo "[OK] $1 is available"
        return 0
    else
        echo "[--] $1 is not installed"
        return 1
    fi
}

echo "Checking available tools..."
HAS_CWEBP=false
HAS_CONVERT=false
HAS_JPEGOPTIM=false
HAS_OPTIPNG=false

check_tool "cwebp" && HAS_CWEBP=true
check_tool "convert" && HAS_CONVERT=true
check_tool "jpegoptim" && HAS_JPEGOPTIM=true
check_tool "optipng" && HAS_OPTIPNG=true

echo ""

# Function to get file size
get_size() {
    if [[ "$OSTYPE" == "darwin"* ]]; then
        stat -f%z "$1" 2>/dev/null || echo 0
    else
        stat -c%s "$1" 2>/dev/null || echo 0
    fi
}

# Function to format size
format_size() {
    local size=$1
    if [ "$size" -ge 1048576 ]; then
        echo "$(echo "scale=2; $size / 1048576" | bc) MB"
    elif [ "$size" -ge 1024 ]; then
        echo "$(echo "scale=2; $size / 1024" | bc) KB"
    else
        echo "$size B"
    fi
}

# Convert JPG/PNG to WebP
convert_to_webp() {
    local input="$1"
    local output="${input%.*}.webp"

    if [ -f "$output" ]; then
        echo "  [SKIP] WebP already exists: $output"
        return
    fi

    if [ "$HAS_CWEBP" = true ]; then
        local before_size=$(get_size "$input")
        cwebp -q 85 "$input" -o "$output" 2>/dev/null
        local after_size=$(get_size "$output")
        local saved=$((before_size - after_size))
        echo "  [WEBP] Created: $output (saved $(format_size $saved))"
    elif [ "$HAS_CONVERT" = true ]; then
        convert "$input" -quality 85 "$output"
        echo "  [WEBP] Created: $output"
    else
        echo "  [SKIP] No WebP converter available"
    fi
}

# Generate responsive image sizes
generate_responsive() {
    local input="$1"
    local basename="${input%.*}"
    local ext="${input##*.}"
    local sizes=(200 400 600 800)

    if [ "$HAS_CONVERT" = false ]; then
        echo "  [SKIP] ImageMagick required for responsive images"
        return
    fi

    for size in "${sizes[@]}"; do
        local output="${basename}-${size}w.webp"
        if [ -f "$output" ]; then
            echo "  [SKIP] Already exists: $output"
            continue
        fi
        convert "$input" -resize "${size}x${size}>" -quality 85 "$output"
        echo "  [RESIZE] Created: $output"
    done
}

# Optimize JPEG
optimize_jpeg() {
    local input="$1"
    if [ "$HAS_JPEGOPTIM" = true ]; then
        local before_size=$(get_size "$input")
        jpegoptim --strip-all --max=85 "$input" 2>/dev/null
        local after_size=$(get_size "$input")
        local saved=$((before_size - after_size))
        if [ "$saved" -gt 0 ]; then
            echo "  [OPT] Optimized: $input (saved $(format_size $saved))"
        else
            echo "  [OK] Already optimized: $input"
        fi
    else
        echo "  [SKIP] jpegoptim not available"
    fi
}

# Optimize PNG
optimize_png() {
    local input="$1"
    if [ "$HAS_OPTIPNG" = true ]; then
        local before_size=$(get_size "$input")
        optipng -o2 -quiet "$input"
        local after_size=$(get_size "$input")
        local saved=$((before_size - after_size))
        if [ "$saved" -gt 0 ]; then
            echo "  [OPT] Optimized: $input (saved $(format_size $saved))"
        else
            echo "  [OK] Already optimized: $input"
        fi
    else
        echo "  [SKIP] optipng not available"
    fi
}

# Process images
echo "Processing images in $IMGS_DIR..."
echo ""

# Process JPEG files
for file in "$IMGS_DIR"/*.jpg "$IMGS_DIR"/*.jpeg; do
    [ -f "$file" ] || continue
    echo "Processing: $(basename "$file")"
    optimize_jpeg "$file"
    convert_to_webp "$file"
done

# Process PNG files
for file in "$IMGS_DIR"/*.png; do
    [ -f "$file" ] || continue
    echo "Processing: $(basename "$file")"
    optimize_png "$file"
    convert_to_webp "$file"
done

# Process blog post images
echo ""
echo "Processing blog post images..."
for dir in "$PROJECT_DIR"/posts/*/; do
    [ -d "$dir" ] || continue
    for file in "$dir"*.jpg "$dir"*.jpeg "$dir"*.png; do
        [ -f "$file" ] || continue
        echo "Processing: $file"
        case "$file" in
            *.jpg|*.jpeg) optimize_jpeg "$file" && convert_to_webp "$file" ;;
            *.png) optimize_png "$file" && convert_to_webp "$file" ;;
        esac
    done
done

echo ""
echo "Done!"
echo ""
echo "To install missing tools on macOS:"
echo "  brew install webp imagemagick jpegoptim optipng"
