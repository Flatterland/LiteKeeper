import * as THREE from 'three';
import { SceneManager } from './scene/SceneManager.js';
import { DiagramManager } from './diagrams/DiagramManager.js';
import { LightController } from './lighting/LightController.js';
import { WipeComparator } from './comparison/WipeComparator.js';
import { UIManager } from './ui/UIManager.js';

class LiteKeeperApp {
  constructor() {
    // Read URL search params for testing / deep linking
    const params = new URLSearchParams(window.location.search);

    this.currentTechnique = params.get('tech') || 'flat';
    this.leftCompareTechnique = params.get('left') || 'gouraud';
    this.rightCompareTechnique = params.get('right') || 'phong';

    const canvasContainer = document.getElementById('canvasContainer');

    // 1. Scene Manager
    this.sceneManager = new SceneManager(canvasContainer);

    // 2. 3D Diagram Manager
    this.diagramManager = new DiagramManager(this.sceneManager.scene);
    if (params.get('diagram') === 'false') {
      this.diagramManager.setVisible(false);
      const diagBtn = document.getElementById('diagramToggleBtn');
      if (diagBtn) diagBtn.classList.remove('active');
    }

    // 3. Interactive Light Controller
    this.lightController = new LightController(
      this.sceneManager.scene,
      this.sceneManager.camera,
      this.sceneManager.renderer.domElement,
      (newPos) => {
        if (this.uiManager) {
          this.uiManager.updateLightCoordinates(newPos);
        }
      }
    );

    if (params.has('lightX') && params.has('lightY') && params.has('lightZ')) {
      this.lightController.setPosition(new THREE.Vector3(
        parseFloat(params.get('lightX')),
        parseFloat(params.get('lightY')),
        parseFloat(params.get('lightZ'))
      ));
    }

    // 4. Wipe Split-screen Comparator
    this.wipeComparator = new WipeComparator(
      this.sceneManager.renderer,
      canvasContainer,
      (ratio) => {
        // split ratio changed
      }
    );
    this.updateWipeLabels();

    if (params.get('wipe') === 'true') {
      const splitRatio = parseFloat(params.get('split') || '0.5');
      this.wipeComparator.setEnabled(true);
      this.wipeComparator.setSplitRatio(splitRatio);
      const wipeBtn = document.getElementById('wipeToggleBtn');
      if (wipeBtn) wipeBtn.classList.add('active');
      const wipeControls = document.getElementById('wipeControls');
      if (wipeControls) wipeControls.classList.remove('hidden');
    }

    // Mesh selection
    if (params.has('mesh')) {
      this.sceneManager.setMeshType(params.get('mesh'));
      const meshSel = document.getElementById('meshSelect');
      if (meshSel) meshSel.value = params.get('mesh');
    }

    // Gouraud subdivisions
    if (params.has('subdiv')) {
      const sub = parseInt(params.get('subdiv'), 10);
      this.sceneManager.setGouraudSubdivisions(sub);
    }

    // 5. UI Manager
    this.uiManager = new UIManager(this);

    // Active button in nav
    const activeBtn = document.querySelector(`.tech-btn[data-tech="${this.currentTechnique}"]`);
    if (activeBtn) {
      document.querySelectorAll('.tech-btn').forEach(b => b.classList.remove('active'));
      activeBtn.classList.add('active');
    }

    // Debug pass
    if (params.has('pass')) {
      const pass = parseInt(params.get('pass'), 10);
      this.setDebugPass(pass);
      const passSel = document.getElementById('debugPassSelect');
      if (passSel) passSel.value = pass;
    }

    // Frame tracking
    this.clock = new THREE.Clock();
    this.frameCount = 0;

    // Apply initial technique
    this.setTechnique(this.currentTechnique);

    // Global hook for headless verification / console inspection
    window.__LITEKEEPER__ = this;

    // Start loop
    this.animate = this.animate.bind(this);
    requestAnimationFrame(this.animate);
  }

  setTechnique(techKey) {
    this.currentTechnique = techKey;
    this.sceneManager.setTechnique(techKey);
    this.diagramManager.setTechnique(techKey);
  }

  setWipeMode(enabled) {
    this.wipeComparator.setEnabled(enabled);
    if (enabled) {
      this.updateWipeLabels();
    }
  }

  setLeftCompareTechnique(techKey) {
    this.leftCompareTechnique = techKey;
    this.updateWipeLabels();
  }

  setRightCompareTechnique(techKey) {
    this.rightCompareTechnique = techKey;
    this.updateWipeLabels();
  }

  updateWipeLabels() {
    const capitalize = (s) => s === 'vct' ? 'Voxel Cone Tracing' : (s === 'raytracing' ? 'Ray Tracing' : s.charAt(0).toUpperCase() + s.slice(1));
    this.wipeComparator.setLabels(
      capitalize(this.leftCompareTechnique),
      capitalize(this.rightCompareTechnique)
    );
  }

  setDebugPass(passIndex) {
    const mat = this.sceneManager.materials[this.currentTechnique];
    if (mat && mat.uniforms && mat.uniforms.uDebugPass) {
      mat.uniforms.uDebugPass.value = passIndex;
    }
    if (this.wipeComparator.enabled) {
      const leftMat = this.sceneManager.materials[this.leftCompareTechnique];
      if (leftMat && leftMat.uniforms && leftMat.uniforms.uDebugPass) {
        leftMat.uniforms.uDebugPass.value = passIndex;
      }
      const rightMat = this.sceneManager.materials[this.rightCompareTechnique];
      if (rightMat && rightMat.uniforms && rightMat.uniforms.uDebugPass) {
        rightMat.uniforms.uDebugPass.value = passIndex;
      }
    }
  }

  animate() {
    requestAnimationFrame(this.animate);

    const delta = this.clock.getDelta();
    const elapsedTime = this.clock.getElapsedTime();
    this.frameCount++;

    this.lightController.update(this.sceneManager.camera);
    this.sceneManager.updateUniforms(this.lightController, elapsedTime, this.frameCount);

    const diagOptions = {
      lightColor: this.lightController.color,
      shininess: this.sceneManager.materials.phong.uniforms.uShininess.value,
      coneCount: this.sceneManager.materials.vct.uniforms.uConeCount.value,
      bounceCount: this.sceneManager.materials.raytracing.uniforms.uBounceCount.value
    };
    this.diagramManager.update(this.lightController.position, this.sceneManager.camera, elapsedTime, diagOptions);

    if (this.wipeComparator.enabled) {
      this.wipeComparator.render(
        this.sceneManager.scene,
        this.sceneManager.camera,
        () => this.sceneManager.renderTechnique(this.leftCompareTechnique),
        () => this.sceneManager.renderTechnique(this.rightCompareTechnique)
      );
    } else {
      this.sceneManager.renderTechnique(this.currentTechnique);
    }
  }
}

window.addEventListener('DOMContentLoaded', () => {
  window.app = new LiteKeeperApp();
});
