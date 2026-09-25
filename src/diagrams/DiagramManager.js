import * as THREE from 'three';
import { FlatDiagram } from './FlatDiagram.js';
import { GouraudDiagram } from './GouraudDiagram.js';
import { PhongDiagram } from './PhongDiagram.js';
import { VoxelConeTracingDiagram } from './VoxelConeTracingDiagram.js';
import { RayTracingDiagram } from './RayTracingDiagram.js';

export class DiagramManager {
  constructor(scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    this.group.name = "LightingDiagramsGroup";
    this.scene.add(this.group);

    this.activeTechnique = 'flat';
    this.visible = true;

    // Instantiate diagrams
    this.diagrams = {
      flat: new FlatDiagram(),
      gouraud: new GouraudDiagram(),
      phong: new PhongDiagram(),
      vct: new VoxelConeTracingDiagram(),
      raytracing: new RayTracingDiagram()
    };

    // Add all diagram objects to group
    for (const key in this.diagrams) {
      this.group.add(this.diagrams[key].group);
      this.diagrams[key].group.visible = false;
    }

    this.setTechnique(this.activeTechnique);
  }

  setTechnique(techKey) {
    this.activeTechnique = techKey;
    for (const key in this.diagrams) {
      this.diagrams[key].group.visible = this.visible && (key === techKey);
    }
  }

  setVisible(visible) {
    this.visible = visible;
    this.group.visible = visible;
    if (visible) {
      this.setTechnique(this.activeTechnique);
    }
  }

  update(lightPos, camera, time, options = {}) {
    if (!this.visible) return;
    const currentDiagram = this.diagrams[this.activeTechnique];
    if (currentDiagram && currentDiagram.update) {
      currentDiagram.update(lightPos, camera, time, options);
    }
  }
}
