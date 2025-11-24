#!/bin/bash
# Generate Open Graph images (1200x630) for social sharing
# Requires: ImageMagick

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
IMGS_DIR="$PROJECT_DIR/imgs"

# Check for ImageMagick
if ! command -v convert &> /dev/null; then
    echo "Error: ImageMagick is required"
    echo "Install with: brew install imagemagick"
    exit 1
fi

echo "Generating Open Graph images..."

# Colors
BG_COLOR="#2563eb"  # Google Blue
TEXT_COLOR="white"

# Generate Home OG image
echo "Creating og-home.png..."
convert -size 1200x630 xc:"$BG_COLOR" \
    -gravity center \
    -fill "$TEXT_COLOR" \
    -font "Helvetica-Bold" \
    -pointsize 72 \
    -annotate 0 "Yuhang Zang" \
    -pointsize 36 \
    -annotate +0+60 "Researcher @ Shanghai AI Laboratory" \
    -pointsize 24 \
    -annotate +0+120 "Multimodal LLMs | Vision-Language Models | RLHF" \
    "$IMGS_DIR/og-home.png"

# Generate Research OG image
echo "Creating og-research.png..."
convert -size 1200x630 xc:"$BG_COLOR" \
    -gravity center \
    -fill "$TEXT_COLOR" \
    -font "Helvetica-Bold" \
    -pointsize 72 \
    -annotate 0 "Publications" \
    -pointsize 36 \
    -annotate +0+60 "Yuhang Zang" \
    -pointsize 24 \
    -annotate +0+120 "NeurIPS | ICLR | CVPR | ICCV | ECCV | ACL" \
    "$IMGS_DIR/og-research.png"

# Generate Team OG image
echo "Creating og-team.png..."
convert -size 1200x630 xc:"$BG_COLOR" \
    -gravity center \
    -fill "$TEXT_COLOR" \
    -font "Helvetica-Bold" \
    -pointsize 72 \
    -annotate 0 "Research Team" \
    -pointsize 36 \
    -annotate +0+60 "Yuhang Zang" \
    -pointsize 24 \
    -annotate +0+120 "Mentored Interns & Collaborators" \
    "$IMGS_DIR/og-team.png"

# Generate Blog OG image
echo "Creating og-blog.png..."
convert -size 1200x630 xc:"$BG_COLOR" \
    -gravity center \
    -fill "$TEXT_COLOR" \
    -font "Helvetica-Bold" \
    -pointsize 72 \
    -annotate 0 "Blog" \
    -pointsize 36 \
    -annotate +0+60 "Yuhang Zang" \
    -pointsize 24 \
    -annotate +0+120 "Research Insights & Updates" \
    "$IMGS_DIR/og-blog.png"

echo ""
echo "Open Graph images generated!"
echo "Generated files:"
ls -la "$IMGS_DIR"/og-*.png 2>/dev/null

echo ""
echo "Don't forget to update the og:image meta tags in your HTML files."
