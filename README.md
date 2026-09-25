# LiteKeeper ⚡

> **Interactive 3D Real-Time Lighting Techniques Comparison Lab built with Three.js & WebGL2**

LiteKeeper is a real-time graphics demonstration platform comparing 5 fundamental and cutting-edge illumination models:
1. **Flat Shading** — Geometric facet-normal evaluation.
2. **Gouraud Shading (1971)** — Pure vertex-computed illumination with hardware interpolation and tessellation sensitivity.
3. **Phong / Blinn-Phong Shading (1975)** — Smooth per-fragment normal interpolation with dynamic specular reflection lobes.
4. **Voxel Cone Tracing (VCT)** — Real-time 3D voxel radiance grid marching, soft diffuse Global Illumination (color bleeding), and glossy specular cones.
5. **Monte Carlo Ray / Path Tracing** — Physically motivated multi-bounce path integration, soft penumbra shadows, and reflection transport.

---

## ✨ Key Features

- **Interactive 3D Explanatory Diagrams**: Real-time vector and ray diagrams rendered directly into the 3D scene (normal arrows $\vec{N}$, incident light rays $\vec{L}$, view rays $\vec{V}$, reflection rays $\vec{R}$, halfway vectors $\vec{H}$, diffuse/specular cone lobes, and multi-bounce ray trees). The diagrams dynamically re-orient and recalculate as you move the light or rotate the camera.
- **Draggable Wipe Comparison Slider**: Perform split-screen scissor-test comparisons between any two lighting techniques side-by-side with synchronized camera and lighting.
- **Technique-Specific Editing Sliders**:
  - *Ray Tracing*: Bounce count ($1-4$), samples per pixel / taps ($1-16$), roughness, light radius (soft shadows), max distance.
  - *Voxel Cone Tracing*: Diffuse cone count ($1-9$), cone aperture angle, voxel grid resolution ($16^3 - 64^3$), indirect GI color bleed multiplier, specular cone roughness, ambient occlusion factor.
  - *Phong*: Specular shininess power, specular intensity, diffuse intensity, falloff decay, Blinn-Phong vs Classic Phong toggle.
  - *Gouraud*: Mesh subdivision slider (dynamically alters polygon tessellation to visualize Gouraud highlight loss and Mach banding), specular shininess, diffuse/specular intensities.
  - *Flat*: Facet roughness, ambient intensity, diffuse hue.
- **Technique-Specific Debug Passes**:
  - *Flat*: Final Combined, Face Normals (RGB), Wireframe/Facets, Pure Diffuse, Incident Angle Heatmap.
  - *Gouraud*: Final Combined, Interpolated Vertex Normals, Raw Vertex Colors, Tessellation Wireframe, Specular Loss Highlight Map.
  - *Phong*: Final Combined, World Normals, Pure Diffuse, Pure Specular Highlight, Ambient Pass, $N \cdot L$ Dot Product Heatmap.
  - *VCT*: Final Combined, 3D Voxel Grid Slices & Occupancy, Direct Light Only, Indirect Diffuse GI (Wall Color Bleed), Indirect Specular Cone, Voxel Ambient Occlusion.
  - *Ray Tracing*: Final Combined, Direct + Soft Shadows, Bounce 1 Indirect GI, Multi-Bounce (2+) Indirect, G-Buffer Normals & Albedo, Ray Traversal Heatmap (Cost), Noise / Variance.
- **3D Light Dragging**: Directly click and drag the emissive yellow light bulb anywhere in 3D space using mouse or touch controls.

---

## 🚀 Quickstart

### Prerequisites
- Node.js 18+ (tested on Node.js 22)
- npm

### Installation & Local Run
```bash
# Clone the repository
git clone https://github.com/Flatterland/LiteKeeper.git
cd LiteKeeper

# Install dependencies
npm install

# Start development server
npm run dev

# Or build for production
npm run build
npm run preview
```

---

## 🛠️ Architecture & Tech Stack

- **Three.js** (WebGL2 / Custom ShaderMaterials)
- **Vite** build tooling
- **Headless Chrome CI / Puppeteer** automated test capture pipeline

---

## 📄 License
MIT
