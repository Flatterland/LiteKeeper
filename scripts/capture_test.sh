#!/bin/bash
set -e

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )/.." && pwd )"
cd "$DIR"

mkdir -p test_reports/screenshots

# Start python static server on port 4173 in background
python3 -m http.server 4173 --directory dist > /dev/null 2>&1 &
SERVER_PID=$!

cleanup() {
  kill $SERVER_PID 2>/dev/null || true
}
trap cleanup EXIT

# Wait for server to be responsive
sleep 1.5

CHROME_FLAGS="--headless=new --use-gl=angle --use-angle=swiftshader --enable-webgl --enable-webgl2 --window-size=1280,720 --virtual-time-budget=3000 --no-sandbox"

echo "Capturing 1: Flat Shading (Combined)..."
google-chrome $CHROME_FLAGS --screenshot=test_reports/screenshots/01_flat_combined.png "http://localhost:4173/?tech=flat&pass=0"

echo "Capturing 2: Flat Shading (Incident Angle Heatmap)..."
google-chrome $CHROME_FLAGS --screenshot=test_reports/screenshots/02_flat_heatmap.png "http://localhost:4173/?tech=flat&pass=4"

echo "Capturing 3: Gouraud Shading (Low Subdivision)..."
google-chrome $CHROME_FLAGS --screenshot=test_reports/screenshots/03_gouraud_lowsubdiv.png "http://localhost:4173/?tech=gouraud&mesh=facetedSphere&subdiv=0&pass=0"

echo "Capturing 4: Gouraud Shading (Specular Loss Map)..."
google-chrome $CHROME_FLAGS --screenshot=test_reports/screenshots/04_gouraud_specloss.png "http://localhost:4173/?tech=gouraud&mesh=facetedSphere&subdiv=1&pass=4"

echo "Capturing 5: Phong Shading (Combined)..."
google-chrome $CHROME_FLAGS --screenshot=test_reports/screenshots/05_phong_combined.png "http://localhost:4173/?tech=phong&pass=0"

echo "Capturing 6: Phong Shading (World Normals)..."
google-chrome $CHROME_FLAGS --screenshot=test_reports/screenshots/06_phong_normals.png "http://localhost:4173/?tech=phong&pass=1"

echo "Capturing 7: Phong Shading (Pure Specular)..."
google-chrome $CHROME_FLAGS --screenshot=test_reports/screenshots/07_phong_specular.png "http://localhost:4173/?tech=phong&pass=3"

echo "Capturing 8: Voxel Cone Tracing (Combined GI)..."
google-chrome $CHROME_FLAGS --screenshot=test_reports/screenshots/08_vct_combined.png "http://localhost:4173/?tech=vct&pass=0"

echo "Capturing 9: Voxel Cone Tracing (3D Voxel Grid Slices)..."
google-chrome $CHROME_FLAGS --screenshot=test_reports/screenshots/09_vct_voxelslices.png "http://localhost:4173/?tech=vct&pass=1"

echo "Capturing 10: Voxel Cone Tracing (Indirect Diffuse GI)..."
google-chrome $CHROME_FLAGS --screenshot=test_reports/screenshots/10_vct_diffuse_gi.png "http://localhost:4173/?tech=vct&pass=3"

echo "Capturing 11: Ray Tracing (Path Traced)..."
google-chrome $CHROME_FLAGS --screenshot=test_reports/screenshots/11_raytracing_pathtraced.png "http://localhost:4173/?tech=raytracing&pass=0"

echo "Capturing 12: Ray Tracing (Heatmap Cost)..."
google-chrome $CHROME_FLAGS --screenshot=test_reports/screenshots/12_raytracing_heatmap.png "http://localhost:4173/?tech=raytracing&pass=5"

echo "Capturing 13: Wipe Comparison (Gouraud vs Phong 50%)..."
google-chrome $CHROME_FLAGS --screenshot=test_reports/screenshots/13_wipe_compare.png "http://localhost:4173/?wipe=true&left=gouraud&right=phong&split=0.5"

echo "Capturing 14: Light Drag Position Shift..."
google-chrome $CHROME_FLAGS --screenshot=test_reports/screenshots/14_light_moved.png "http://localhost:4173/?tech=phong&lightX=-1.5&lightY=1.5&lightZ=1.0"

echo "All captures successfully recorded in test_reports/screenshots/"
ls -la test_reports/screenshots/
