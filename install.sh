#!/bin/bash

# Price Tracker Go Backend Installer
# This script builds and installs the Go backend for Firefox

set -e

echo "🚀 Price Tracker Go Backend Installer"
echo "======================================"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if Go is installed
if ! command -v go &> /dev/null; then
    echo -e "${RED}❌ Go is not installed!${NC}"
    echo "Please install Go from: https://golang.org/dl/"
    exit 1
fi

echo -e "${GREEN}✅ Go found: $(go version)${NC}"

# Create directories
echo "📁 Creating directories..."
mkdir -p ~/price-tracker-backend
cd ~/price-tracker-backend

# Install dependencies
echo "📦 Installing Go dependencies..."
go mod init price-tracker-backend 2>/dev/null || true
go get golang.org/x/net/html

# Build the binary
echo "🔨 Building Go backend..."
go build -o price-tracker-backend main.go

if [ ! -f "price-tracker-backend" ]; then
    echo -e "${RED}❌ Build failed!${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Build successful!${NC}"

# Install binary
echo "📦 Installing binary..."
sudo cp price-tracker-backend /usr/local/bin/
sudo chmod +x /usr/local/bin/price-tracker-backend

# Determine Firefox profile directory
FIREFOX_DIR=""

if [[ "$OSTYPE" == "linux-gnu"* ]]; then
    FIREFOX_DIR="$HOME/.mozilla/native-messaging-hosts"
elif [[ "$OSTYPE" == "darwin"* ]]; then
    FIREFOX_DIR="$HOME/Library/Application Support/Mozilla/NativeMessagingHosts"
else
    echo -e "${RED}❌ Unsupported OS: $OSTYPE${NC}"
    exit 1
fi

echo "📁 Firefox directory: $FIREFOX_DIR"

# Create native messaging manifest
echo "📝 Creating native messaging manifest..."
mkdir -p "$FIREFOX_DIR"

cat > "$FIREFOX_DIR/com.pricetracker.native.json" << EOF
{
  "name": "com.pricetracker.native",
  "description": "Price Tracker Go Backend",
  "path": "/usr/local/bin/price-tracker-backend",
  "type": "stdio",
  "allowed_extensions": [
    "fiyat-takipci-pro@github.io"
  ]
}
EOF

echo -e "${GREEN}✅ Manifest created!${NC}"

# Test the backend
echo "🧪 Testing backend..."
echo '{"action":"ping"}' | /usr/local/bin/price-tracker-backend > /dev/null 2>&1 && \
    echo -e "${GREEN}✅ Backend test successful!${NC}" || \
    echo -e "${YELLOW}⚠️  Backend test failed (this might be normal)${NC}"

# Create uninstall script
echo "📝 Creating uninstall script..."
cat > ~/price-tracker-backend/uninstall.sh << 'EOF'
#!/bin/bash
echo "🗑️  Uninstalling Price Tracker Go Backend..."
sudo rm -f /usr/local/bin/price-tracker-backend
rm -f "$HOME/.mozilla/native-messaging-hosts/com.pricetracker.native.json" 2>/dev/null || true
rm -f "$HOME/Library/Application Support/Mozilla/NativeMessagingHosts/com.pricetracker.native.json" 2>/dev/null || true
echo "✅ Uninstall complete!"
EOF

chmod +x ~/price-tracker-backend/uninstall.sh

echo ""
echo -e "${GREEN}✅ Installation complete!${NC}"
echo ""
echo "📋 Summary:"
echo "  - Binary: /usr/local/bin/price-tracker-backend"
echo "  - Manifest: $FIREFOX_DIR/com.pricetracker.native.json"
echo "  - Logs: /tmp/price-tracker-go.log"
echo ""
echo "🔧 Next steps:"
echo "  1. Restart Firefox"
echo "  2. Open the extension"
echo "  3. Check if 'Go Backend' is connected in settings"
echo ""
echo "To uninstall, run: ~/price-tracker-backend/uninstall.sh"
echo ""