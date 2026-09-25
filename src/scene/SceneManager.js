import * as THREE from 'three';
import { createFlatMaterial } from '../shaders/FlatShader.js';
import { createGouraudMaterial } from '../shaders/GouraudShader.js';
import { createPhongMaterial } from '../shaders/PhongShader.js';
import { createVoxelConeTracingMaterial } from '../shaders/VoxelConeTracingShader.js';
import { createRayTracingMaterial } from '../shaders/RayTracingShader.js';

export class SceneManager {
  constructor(canvasContainer) {
    this.container = canvasContainer;

    // 1. Renderer
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.container.appendChild(this.renderer.domElement);

    // 2. Scene & Camera
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x090d16);

    const aspect = this.container.clientWidth / this.container.clientHeight;
    this.camera = new THREE.PerspectiveCamera(45, aspect, 0.1, 100);
    this.camera.position.set(0, 1.8, 5.0);
    this.cameraTarget = new THREE.Vector3(0, 1.1, 0);
    this.camera.lookAt(this.cameraTarget);

    // 3. Materials dictionary
    this.materials = {
      flat: createFlatMaterial(),
      gouraud: createGouraudMaterial(),
      phong: createPhongMaterial(),
      vct: createVoxelConeTracingMaterial(),
      raytracing: createRayTracingMaterial()
    };

    // 4. Ray Tracing Full-screen Quad Scene
    this.rtScene = new THREE.Scene();
    this.rtCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const quadGeo = new THREE.PlaneGeometry(2, 2);
    this.rtQuad = new THREE.Mesh(quadGeo, this.materials.raytracing);
    this.rtScene.add(this.rtQuad);

    // Current State
    this.activeTechnique = 'flat';
    this.activeMeshType = 'torusKnot';
    this.gouraudSubdivisions = 2; // For dynamic tessellation demo

    this.initShowroom();
    this.initCentralMesh();
    this.setupOrbitControls();
    this.setupResizeHandler();
  }

  initShowroom() {
    this.roomGroup = new THREE.Group();
    this.roomGroup.name = "CornellShowroom";

    // Cornell Box boundaries: [-3, 3] x [-1, 4] x [-3, 3]
    const planeGeo = new THREE.PlaneGeometry(6, 5);

    // Left Wall (Red)
    const leftMat = new THREE.MeshStandardMaterial({ color: 0xdd2222, roughness: 0.8 });
    const leftWall = new THREE.Mesh(planeGeo, leftMat);
    leftWall.position.set(-3, 1.5, 0);
    leftWall.rotation.y = Math.PI / 2;
    this.roomGroup.add(leftWall);

    // Right Wall (Green)
    const rightMat = new THREE.MeshStandardMaterial({ color: 0x22c55e, roughness: 0.8 });
    const rightWall = new THREE.Mesh(planeGeo, rightMat);
    rightWall.position.set(3, 1.5, 0);
    rightWall.rotation.y = -Math.PI / 2;
    this.roomGroup.add(rightWall);

    // Back Wall (White)
    const backMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.9 });
    const backWall = new THREE.Mesh(new THREE.PlaneGeometry(6, 5), backMat);
    backWall.position.set(0, 1.5, -3);
    this.roomGroup.add(backWall);

    // Floor (Checkered grid)
    const floorGeo = new THREE.PlaneGeometry(6, 6);
    const floorMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.6 });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.position.set(0, -1, 0);
    floor.rotation.x = -Math.PI / 2;
    this.roomGroup.add(floor);

    // Floor grid overlay for depth cues
    const grid = new THREE.GridHelper(6, 20, 0x38bdf8, 0x334155);
    grid.position.set(0, -0.99, 0);
    this.roomGroup.add(grid);

    // Ceiling (White)
    const ceilMat = new THREE.MeshStandardMaterial({ color: 0xf1f5f9, roughness: 0.9 });
    const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(6, 6), ceilMat);
    ceiling.position.set(0, 4, 0);
    ceiling.rotation.x = Math.PI / 2;
    this.roomGroup.add(ceiling);

    // Secondary Props (Metallic & Copper spheres)
    const prop1Geo = new THREE.SphereGeometry(0.65, 32, 32);
    const prop1Mat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, metalness: 0.95, roughness: 0.05 });
    this.prop1 = new THREE.Mesh(prop1Geo, prop1Mat);
    this.prop1.position.set(-1.6, -0.35, -0.6);
    this.roomGroup.add(this.prop1);

    const prop2Geo = new THREE.SphereGeometry(0.65, 32, 32);
    const prop2Mat = new THREE.MeshStandardMaterial({ color: 0xf97316, metalness: 0.85, roughness: 0.25 });
    this.prop2 = new THREE.Mesh(prop2Geo, prop2Mat);
    this.prop2.position.set(1.6, -0.35, 0.4);
    this.roomGroup.add(this.prop2);

    this.scene.add(this.roomGroup);
  }

  initCentralMesh() {
    this.meshGroup = new THREE.Group();
    this.meshGroup.name = "CentralMeshGroup";
    this.meshGroup.position.set(0, 1.1, 0);
    this.scene.add(this.meshGroup);

    this.updateMeshGeometry();
  }

  updateMeshGeometry() {
    // Clear old mesh
    while (this.meshGroup.children.length > 0) {
      this.meshGroup.remove(this.meshGroup.children[0]);
    }

    let geometry;
    switch (this.activeMeshType) {
      case 'facetedSphere':
        // Low-poly icosahedron - shows Flat and Gouraud artifacts clearly
        geometry = new THREE.IcosahedronGeometry(1.2, this.gouraudSubdivisions);
        break;
      case 'smoothSphere':
        geometry = new THREE.SphereGeometry(1.2, 48, 48);
        break;
      case 'cube':
        geometry = new THREE.BoxGeometry(1.8, 1.8, 1.8);
        break;
      case 'cylinder':
        geometry = new THREE.CylinderGeometry(0.9, 0.9, 2.0, 32);
        break;
      case 'torusKnot':
      default:
        geometry = new THREE.TorusKnotGeometry(0.85, 0.3, 128, 32);
        break;
    }

    // Assign current material
    const currentMat = this.materials[this.activeTechnique] || this.materials.phong;
    this.centralMesh = new THREE.Mesh(geometry, currentMat);
    this.meshGroup.add(this.centralMesh);
  }

  setMeshType(type) {
    this.activeMeshType = type;
    this.updateMeshGeometry();
  }

  setGouraudSubdivisions(subdiv) {
    this.gouraudSubdivisions = subdiv;
    if (this.activeMeshType === 'facetedSphere') {
      this.updateMeshGeometry();
    }
  }

  setTechnique(techKey) {
    this.activeTechnique = techKey;
    const mat = this.materials[techKey] || this.materials.phong;

    if (this.centralMesh && techKey !== 'raytracing') {
      this.centralMesh.material = mat;
    }

    // Toggle showroom visibility in pure Ray Tracing mode (as ray tracer renders the entire room analytically)
    if (this.roomGroup) {
      this.roomGroup.visible = (techKey !== 'raytracing');
    }
    if (this.centralMesh) {
      this.centralMesh.visible = (techKey !== 'raytracing');
    }
  }

  setupOrbitControls() {
    // Mouse orbit controls with damping
    let isMouseDown = false;
    let prevMouseX = 0;
    let prevMouseY = 0;
    this.spherical = { radius: 5.2, theta: 0.0, phi: Math.PI / 2.3 };

    const updateCameraFromSpherical = () => {
      this.camera.position.x = this.cameraTarget.x + this.spherical.radius * Math.sin(this.spherical.phi) * Math.sin(this.spherical.theta);
      this.camera.position.y = this.cameraTarget.y + this.spherical.radius * Math.cos(this.spherical.phi);
      this.camera.position.z = this.cameraTarget.z + this.spherical.radius * Math.sin(this.spherical.phi) * Math.cos(this.spherical.theta);
      this.camera.lookAt(this.cameraTarget);
    };

    updateCameraFromSpherical();

    const dom = this.renderer.domElement;
    dom.addEventListener('pointerdown', (e) => {
      // Don't orbit if dragging light gizmo
      if (dom.style.cursor === 'grabbing' || dom.style.cursor === 'grab') return;
      isMouseDown = true;
      prevMouseX = e.clientX;
      prevMouseY = e.clientY;
    });

    window.addEventListener('pointermove', (e) => {
      if (!isMouseDown) return;
      const dx = e.clientX - prevMouseX;
      const dy = e.clientY - prevMouseY;
      prevMouseX = e.clientX;
      prevMouseY = e.clientY;

      this.spherical.theta -= dx * 0.007;
      this.spherical.phi = Math.max(0.1, Math.min(Math.PI - 0.1, this.spherical.phi - dy * 0.007));
      updateCameraFromSpherical();
    });

    window.addEventListener('pointerup', () => { isMouseDown = false; });

    dom.addEventListener('wheel', (e) => {
      this.spherical.radius = Math.max(2.5, Math.min(10.0, this.spherical.radius + e.deltaY * 0.004));
      updateCameraFromSpherical();
      e.preventDefault();
    }, { passive: false });

    this.resetCamera = () => {
      this.spherical = { radius: 5.2, theta: 0.0, phi: Math.PI / 2.3 };
      updateCameraFromSpherical();
    };
  }

  setupResizeHandler() {
    window.addEventListener('resize', () => {
      const width = this.container.clientWidth;
      const height = this.container.clientHeight;
      this.camera.aspect = width / height;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(width, height);

      // Update ray tracing resolution uniform
      if (this.materials.raytracing && this.materials.raytracing.uniforms.uResolution) {
        this.materials.raytracing.uniforms.uResolution.value.set(width, height);
      }
    });
  }

  updateUniforms(lightController, time, frameCount) {
    const lightPos = lightController.position;
    const lightCol = lightController.color;
    const lightInt = lightController.intensity;

    // Update shared uniforms across all technique materials
    for (const key in this.materials) {
      const mat = this.materials[key];
      if (!mat || !mat.uniforms) continue;

      if (mat.uniforms.uLightPos) mat.uniforms.uLightPos.value.copy(lightPos);
      if (mat.uniforms.uLightColor) mat.uniforms.uLightColor.value.copy(lightCol);
      if (mat.uniforms.uLightIntensity) mat.uniforms.uLightIntensity.value = lightInt;
      if (mat.uniforms.uCameraPos) mat.uniforms.uCameraPos.value.copy(this.camera.position);
      if (mat.uniforms.uTime) mat.uniforms.uTime.value = time;
    }

    // Ray tracing specific inverse matrices
    const rtMat = this.materials.raytracing;
    if (rtMat && rtMat.uniforms) {
      this.camera.updateMatrixWorld();
      rtMat.uniforms.uInvProjection.value.copy(this.camera.projectionMatrixInverse);
      rtMat.uniforms.uInvView.value.copy(this.camera.matrixWorld);
      rtMat.uniforms.uCameraTarget.value.copy(this.cameraTarget);
      rtMat.uniforms.uFrameCount.value = frameCount;

      let shapeCode = 0;
      if (this.activeMeshType === 'smoothSphere') shapeCode = 2; // mirror
      else if (this.activeMeshType === 'facetedSphere') shapeCode = 1; // gold
      rtMat.uniforms.uCentralShape.value = shapeCode;
    }
  }

  renderTechnique(techKey) {
    if (techKey === 'raytracing') {
      const roomVis = this.roomGroup ? this.roomGroup.visible : false;
      const meshVis = this.centralMesh ? this.centralMesh.visible : false;
      if (this.roomGroup) this.roomGroup.visible = false;
      if (this.centralMesh) this.centralMesh.visible = false;

      this.renderer.render(this.rtScene, this.rtCamera);

      this.renderer.autoClear = false;
      this.renderer.clearDepth();
      const savedBg = this.scene.background;
      this.scene.background = null;
      this.renderer.render(this.scene, this.camera);
      this.scene.background = savedBg;
      this.renderer.autoClear = true;

      if (this.roomGroup) this.roomGroup.visible = roomVis;
      if (this.centralMesh) this.centralMesh.visible = meshVis;
    } else {
      if (this.centralMesh) {
        this.centralMesh.material = this.materials[techKey];
        this.centralMesh.visible = true;
      }
      if (this.roomGroup) this.roomGroup.visible = true;
      this.renderer.render(this.scene, this.camera);
    }
  }
}
