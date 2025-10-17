IMAGE_NAME="stl1te/hyperliquid-trades-feed"
PACKAGE_VERSION=$(node -p "require('./package.json').version")
docker build -f Dockerfile -t $IMAGE_NAME:latest -t $IMAGE_NAME:"$PACKAGE_VERSION" .