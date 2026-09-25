import * as THREE from 'three';
import { createFlatMaterial } from '../shaders/FlatShader.js';
import { createGouraudMaterial } from '../shaders/GouraudShader.js';
import { createPhongMaterial } from '../shaders/PhongShader.js';
import { createVoxelConeTracingMaterial } from '../shaders/VoxelConeTracingShader.js';
import { createRayTracingMaterial } from '../shaders/RayTracingShader.js';

export class SceneManager {
  constructor(canvasContainer) {
    this.container = canvasContainer;

    // 1. WebGL Renderer
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
    this.camera.position.set(0, 1.2, 4.5);
    this.cameraTarget = new THREE.Vector3(0, 0.5, 0);
    this.camera.lookAt(this.cameraTarget);

    // 3. Ray Tracing Full-screen Quad Scene
    this.rtScene = new THREE.Scene();
    this.rtCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.rtMaterial = createRayTracingMaterial();
    const quadGeo = new THREE.PlaneGeometry(2, 2);
    this.rtQuad = new THREE.Mesh(quadGeo, this.rtMaterial);
    this.rtScene.add(this.rtQuad);

    // 4. Current State
    this.activeTechnique = 'flat';
    this.subdivisions = 2; // For Gouraud dynamic tessellation

    // 5. Build Unified Scene & Materials
    this.initUnifiedScene();
    this.setupOrbitControls();
    this.setupResizeHandler();
  }

  initUnifiedScene() {
    this.sceneGroup = new THREE.Group();
    this.sceneGroup.name = "UnifiedCornellScene";

    // Cornell Box bounds: [-2.5, 2.5] x [-1.2, 3.2] x [-2.5, 2.5]
    const wallGeoX = new THREE.PlaneGeometry(5.0, 4.4); // For Left/Right walls
    const wallGeoZ = new THREE.PlaneGeometry(5.0, 4.4); // For Back wall
    const floorGeo = new THREE.PlaneGeometry(5.0, 5.0); // For Floor/Ceiling

    // Left Wall (x = -2.5, normal = (1, 0, 0))
    const leftWall = new THREE.Mesh(wallGeoX);
    leftWall.position.set(-2.5, 1.0, 0.0);
    leftWall.rotation.y = Math.PI / 2;
    this.sceneGroup.add(leftWall);

    // Right Wall (x = 2.5, normal = (-1, 0, 0))
    const rightWall = new THREE.Mesh(wallGeoX);
    rightWall.position.set(2.5, 1.0, 0.0);
    rightWall.rotation.y = -Math.PI / 2;
    this.sceneGroup.add(rightWall);

    // Back Wall (z = -2.5, normal = (0, 0, 1))
    const backWall = new THREE.Mesh(wallGeoZ);
    backWall.position.set(0.0, 1.0, -2.5);
    this.sceneGroup.add(backWall);

    // Floor (y = -1.2, normal = (0, 1, 0))
    const floor = new THREE.Mesh(floorGeo);
    floor.position.set(0.0, -1.2, 0.0);
    floor.rotation.x = -Math.PI / 2;
    this.sceneGroup.add(floor);

    // Floor subtle grid overlay
    const grid = new THREE.GridHelper(5.0, 16, 0x38bdf8, 0x334155);
    grid.position.set(0.0, -1.19, 0.0);
    this.sceneGroup.add(grid);

    // Ceiling (y = 3.2, normal = (0, -1, 0))
    const ceiling = new THREE.Mesh(floorGeo);
    ceiling.position.set(0.0, 3.2, 0.0);
    ceiling.rotation.x = Math.PI / 2;
    this.sceneGroup.add(ceiling);

    // Three Central Models:
    // 1. Cube at (-1.1, -0.65, -0.4), size 1.1, rotated 20 deg
    const cubeGeo = new THREE.BoxGeometry(1.1, 1.1, 1.1);
    this.cubeMesh = new THREE.Mesh(cubeGeo);
    this.cubeMesh.position.set(-1.1, -0.65, -0.4);
    this.cubeMesh.rotation.y = 0.35;
    this.sceneGroup.add(this.cubeMesh);

    // 2. Sphere at (1.1, -0.65, 0.3), radius 0.55
    this.sphereGeo = this.createSphereGeometry(this.subdivisions);
    this.sphereMesh = new THREE.Mesh(this.sphereGeo);
    this.sphereMesh.position.set(1.1, -0.65, 0.3);
    this.sceneGroup.add(this.sphereMesh);

    // 3. Cone at (0.0, -0.6, 0.8), height 1.2, radius 0.5
    this.coneGeo = this.createConeGeometry(this.subdivisions);
    this.coneMesh = new THREE.Mesh(this.coneGeo);
    this.coneMesh.position.set(0.0, -0.6, 0.8);
    this.sceneGroup.add(this.coneMesh);

    this.scene.add(this.sceneGroup);

    // Definition of all objects with their base color
    this.objectDefs = [
      { id: 'leftWall', mesh: leftWall, color: new THREE.Color(0.9, 0.15, 0.2) },
      { id: 'rightWall', mesh: rightWall, color: new THREE.Color(0.15, 0.85, 0.3) },
      { id: 'backWall', mesh: backWall, color: new THREE.Color(0.9, 0.9, 0.92) },
      { id: 'floor', mesh: floor, color: new THREE.Color(0.7, 0.7, 0.72) },
      { id: 'ceiling', mesh: ceiling, color: new THREE.Color(0.9, 0.9, 0.92) },
      { id: 'cube', mesh: this.cubeMesh, color: new THREE.Color(0.88, 0.88, 0.9) },
      { id: 'sphere', mesh: this.sphereMesh, color: new THREE.Color(0.2, 0.7, 0.95) },
      { id: 'cone', mesh: this.coneMesh, color: new THREE.Color(0.95, 0.65, 0.15) }
    ];

    // Build material instances for each technique & object
    this.techniqueMaterials = {
      flat: {},
      gouraud: {},
      phong: {},
      vct: {}
    };

    const techCreators = {
      flat: createFlatMaterial,
      gouraud: createGouraudMaterial,
      phong: createPhongMaterial,
      vct: createVoxelConeTracingMaterial
    };

    for (const tech in techCreators) {
      const creator = techCreators[tech];
      this.objectDefs.forEach(obj => {
        this.techniqueMaterials[tech][obj.id] = creator({
          uDiffuseColor: obj.color
        });
      });
    }

    // Apply initial technique materials
    this.setTechnique(this.activeTechnique);
  }

  createSphereGeometry(subdiv) {
    if (subdiv <= 0) {
      return new THREE.IcosahedronGeometry(0.55, 0);
    } else if (subdiv === 1) {
      return new THREE.IcosahedronGeometry(0.55, 1);
    } else if (subdiv === 2) {
      return new THREE.IcosahedronGeometry(0.55, 2);
    } else if (subdiv === 3) {
      return new THREE.IcosahedronGeometry(0.55, 3);
    } else {
      return new THREE.SphereGeometry(0.55, 48, 48);
    }
  }

  createConeGeometry(subdiv) {
    const segments = Math.max(6, 6 * Math.pow(2, subdiv));
    return new THREE.ConeGeometry(0.5, 1.2, segments, subdiv > 1 ? 4 : 1);
  }

  setGouraudSubdivisions(subdiv) {
    this.subdivisions = subdiv;
    if (this.sphereMesh) {
      this.sphereMesh.geometry.dispose();
      this.sphereMesh.geometry = this.createSphereGeometry(subdiv);
    }
    if (this.coneMesh) {
      this.coneMesh.geometry.dispose();
      this.coneMesh.geometry = this.createConeGeometry(subdiv);
    }
  }

  setTechnique(techKey) {
    this.activeTechnique = techKey;
    if (techKey === 'raytracing') {
      if (this.sceneGroup) this.sceneGroup.visible = false;
      return;
    }

    if (this.sceneGroup) this.sceneGroup.visible = true;

    // Assign technique materials to all scene meshes
    const mats = this.techniqueMaterials[techKey];
    if (mats) {
      this.objectDefs.forEach(obj => {
        if (mats[obj.id]) {
          obj.mesh.material = mats[obj.id];
        }
      });
    }
  }

  applyMaterialPass(techKey) {
    const mats = this.techniqueMaterials[techKey];
    if (mats) {
      this.objectDefs.forEach(obj => {
        if (mats[obj.id]) {
          obj.mesh.material = mats[obj.id];
        }
      });
    }
  }

  setupOrbitControls() {
    let isMouseDown = false;
    let prevMouseX = 0;
    let prevMouseY = 0;
    this.spherical = { radius: 5.0, theta: 0.0, phi: Math.PI / 2.3 };

    const updateCamera = () => {
      this.camera.position.x = this.cameraTarget.x + this.spherical.radius * Math.sin(this.spherical.phi) * Math.sin(this.spherical.theta);
      this.camera.position.y = this.cameraTarget.y + this.spherical.radius * Math.cos(this.spherical.phi);
      this.camera.position.z = this.cameraTarget.z + this.spherical.radius * Math.sin(this.spherical.phi) * Math.cos(this.spherical.theta);
      this.camera.lookAt(this.cameraTarget);
    };

    updateCamera();

    const dom = this.renderer.domElement;
    dom.addEventListener('pointerdown', (e) => {
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
      updateCamera();
    });

    window.addEventListener('pointerup', () => { isMouseDown = false; });

    dom.addEventListener('wheel', (e) => {
      this.spherical.radius = Math.max(2.5, Math.min(8.5, this.spherical.radius + e.deltaY * 0.004));
      updateCamera();
      e.preventDefault();
    }, { passive: false });

    this.resetCamera = () => {
      this.spherical = { radius: 5.0, theta: 0.0, phi: Math.PI / 2.3 };
      updateCamera();
    };

    this.setCameraPreset = (preset) => {
      if (preset === 'overview') {
        this.spherical = { radius: 5.0, theta: 0.0, phi: Math.PI / 2.3 };
      } else if (preset === 'sphere') {
        this.cameraTarget.set(1.1, -0.65, 0.3);
        this.spherical = { radius: 2.5, theta: 0.4, phi: Math.PI / 2.2 };
      } else if (preset === 'cone') {
        this.cameraTarget.set(0.0, -0.6, 0.8);
        this.spherical = { radius: 2.5, theta: -0.2, phi: Math.PI / 2.2 };
      } else if (preset === 'cube') {
        this.cameraTarget.set(-1.1, -0.65, -0.4);
        this.spherical = { radius: 2.6, theta: -0.5, phi: Math.PI / 2.2 };
      } else if (preset === 'top') {
        this.cameraTarget.set(0, 0.2, 0);
        this.spherical = { radius: 5.0, theta: 0.0, phi: 0.2 };
      }
      updateCamera();
    };
  }

  setupResizeHandler() {
    window.addEventListener('resize', () => {
      const width = this.container.clientWidth;
      const height = this.container.clientHeight;
      this.camera.aspect = width / height;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(width, height);

      if (this.rtMaterial && this.rtMaterial.uniforms && this.rtMaterial.uniforms.uResolution) {
        this.rtMaterial.uniforms.uResolution.value.set(width, height);
      }
    });
  }

  updateUniforms(lightController, time, frameCount) {
    const lightPos = lightController.position;
    const lightCol = lightController.color;
    const lightInt = lightController.intensity;

    // Update uniforms across all technique materials
    for (const tech in this.techniqueMaterials) {
      const mats = this.techniqueMaterials[tech];
      for (const objId in mats) {
        const mat = mats[objId];
        if (!mat || !mat.uniforms) continue;

        if (mat.uniforms.uLightPos) mat.uniforms.uLightPos.value.copy(lightPos);
        if (mat.uniforms.uLightColor) mat.uniforms.uLightColor.value.copy(lightCol);
        if (mat.uniforms.uLightIntensity) mat.uniforms.uLightIntensity.value = lightInt;
        if (mat.uniforms.uCameraPos) mat.uniforms.uCameraPos.value.copy(this.camera.position);
        if (mat.uniforms.uTime) mat.uniforms.uTime.value = time;
      }
    }

    // Update Ray Tracing shader uniforms
    if (this.rtMaterial && this.rtMaterial.uniforms) {
      this.camera.updateMatrixWorld();
      this.rtMaterial.uniforms.uInvProjection.value.copy(this.camera.projectionMatrixInverse);
      this.rtMaterial.uniforms.uInvView.value.copy(this.camera.matrixWorld);
      this.rtMaterial.uniforms.uCameraPos.value.copy(this.camera.position);
      this.rtMaterial.uniforms.uCameraTarget.value.copy(this.cameraTarget);
      this.rtMaterial.uniforms.uLightPos.value.copy(lightPos);
      this.rtMaterial.uniforms.uLightColor.value.copy(lightCol);
      this.rtMaterial.uniforms.uLightIntensity.value = lightInt;
      this.rtMaterial.uniforms.uTime.value = time;
      this.rtMaterial.uniforms.uFrameCount.value = frameCount;
    }
  }

  renderTechnique(techKey) {
    if (techKey === 'raytracing') {
      // 1. Render Ray Tracing scene
      this.renderer.render(this.rtScene, this.rtCamera);

      // 2. Render overlays (3D diagrams and light gizmo) without clearing background
      this.renderer.autoClear = false;
      this.renderer.clearDepth();

      if (this.sceneGroup) this.sceneGroup.visible = false;
      const savedBg = this.scene.background;
      this.scene.background = null;

      this.renderer.render(this.scene, this.camera);

      this.scene.background = savedBg;
      this.renderer.autoClear = true;
    } else {
      if (this.sceneGroup) this.sceneGroup.visible = true;
      this.applyMaterialPass(techKey);
      this.renderer.render(this.scene, this.camera);
    }
  }

  setTechniqueUniform(techKey, uniformName, value) {
    if (techKey === 'raytracing') {
      if (this.rtMaterial && this.rtMaterial.uniforms && this.rtMaterial.uniforms[uniformName]) {
        this.rtMaterial.uniforms[uniformName].value = value;
      }
      return;
    }
    const mats = this.techniqueMaterials[techKey];
    if (mats) {
      for (const id in mats) {
        if (mats[id].uniforms && mats[id].uniforms[uniformName]) {
          mats[id].uniforms[uniformName].value = value;
        }
      }
    }
  }

  getTechniqueUniform(techKey, uniformName) {
    if (techKey === 'raytracing') {
      return this.rtMaterial?.uniforms?.[uniformName]?.value;
    }
    const mats = this.techniqueMaterials[techKey];
    if (mats) {
      const first = mats['sphere'] || Object.values(mats)[0];
      return first?.uniforms?.[uniformName]?.value;
    }
    return null;
  }
}
