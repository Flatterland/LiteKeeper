import * as THREE from 'three';

export class VoxelConeTracingDiagram {
  constructor() {
    this.group = new THREE.Group();
    this.group.name = "VoxelConeTracingDiagram";

    this.origin = new THREE.Vector3(0.0, 1.35, 0.2);
    this.group.position.copy(this.origin);

    this.initGeometry();
  }

  initGeometry() {
    // 1. 3D Voxel Grid Box representation (wireframe cubes)
    const voxelBoxGroup = new THREE.Group();
    const boxGeo = new THREE.BoxGeometry(0.3, 0.3, 0.3);
    const boxEdges = new THREE.EdgesGeometry(boxGeo);
    const lineMat = new THREE.LineBasicMaterial({ color: 0x334155, transparent: true, opacity: 0.5 });

    // 4x4x4 mini voxel grid
    for (let x = -1; x <= 1; x++) {
      for (let y = -1; y <= 1; y++) {
        for (let z = 0; z <= 2; z++) {
          const wireBox = new THREE.LineSegments(boxEdges, lineMat);
          wireBox.position.set(x * 0.35, y * 0.35, z * 0.35);
          voxelBoxGroup.add(wireBox);
        }
      }
    }
    this.group.add(voxelBoxGroup);

    // Hit surface point
    this.pointP = new THREE.Vector3(0, 0, 0);
    const dot = new THREE.Mesh(
      new THREE.SphereGeometry(0.06, 16, 16),
      new THREE.MeshBasicMaterial({ color: 0x00f0ff })
    );
    this.group.add(dot);

    // 2. Cones
    // Central normal diffuse cone
    this.diffuseCones = [];
    const coneMatCentral = new THREE.MeshBasicMaterial({
      color: 0x00f0ff,
      transparent: true,
      opacity: 0.25,
      wireframe: true,
      side: THREE.DoubleSide
    });

    const coneGeo = new THREE.ConeGeometry(0.45, 1.2, 16, 4, true);
    coneGeo.translate(0, 0.6, 0);
    coneGeo.rotateX(Math.PI / 2);

    const normalCone = new THREE.Mesh(coneGeo, coneMatCentral);
    this.group.add(normalCone);
    this.diffuseCones.push(normalCone);

    // 4 Hemispherical tilted cones
    const coneMatSide = new THREE.MeshBasicMaterial({
      color: 0xfacc15,
      transparent: true,
      opacity: 0.2,
      wireframe: true,
      side: THREE.DoubleSide
    });

    for (let i = 0; i < 4; i++) {
      const sideCone = new THREE.Mesh(coneGeo.clone(), coneMatSide);
      this.group.add(sideCone);
      this.diffuseCones.push(sideCone);
    }

    // Specular Cone (aligned with R)
    const specMat = new THREE.MeshBasicMaterial({
      color: 0xf43f5e,
      transparent: true,
      opacity: 0.3,
      wireframe: false,
      side: THREE.DoubleSide
    });
    const specConeGeo = new THREE.ConeGeometry(0.25, 1.3, 16, 1, true);
    specConeGeo.translate(0, 0.65, 0);
    specConeGeo.rotateX(Math.PI / 2);
    this.specularCone = new THREE.Mesh(specConeGeo, specMat);
    this.group.add(this.specularCone);

    // Billboard Canvas
    this.labelCanvas = document.createElement('canvas');
    this.labelCanvas.width = 512;
    this.labelCanvas.height = 256;
    this.labelCtx = this.labelCanvas.getContext('2d');
    this.labelTexture = new THREE.CanvasTexture(this.labelCanvas);

    const spriteMat = new THREE.SpriteMaterial({ map: this.labelTexture, transparent: true });
    this.labelSprite = new THREE.Sprite(spriteMat);
    this.labelSprite.position.set(0, -0.7, 0);
    this.labelSprite.scale.set(1.4, 0.7, 1.0);
    this.group.add(this.labelSprite);
  }

  update(lightWorldPos, camera, time, options = {}) {
    const N = new THREE.Vector3(0, 0, 1);
    const worldP = this.origin.clone().add(this.pointP);
    const V = camera.position.clone().sub(worldP).normalize();
    const L = lightWorldPos.clone().sub(worldP).normalize();
    const R = V.clone().negate().reflect(N).normalize();

    // Orient specular cone along R
    const quatR = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), R);
    this.specularCone.quaternion.copy(quatR);

    // Tilted diffuse cones at 45 deg around N
    const angleStep = (Math.PI * 2) / 4;
    for (let i = 0; i < 4; i++) {
      const phi = i * angleStep;
      const dir = new THREE.Vector3(Math.cos(phi) * 0.5, Math.sin(phi) * 0.5, 0.8).normalize();
      const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir);
      this.diffuseCones[i + 1].quaternion.copy(q);
    }

    // Cone count control
    const coneCount = options.coneCount || 5;
    for (let i = 1; i <= 4; i++) {
      this.diffuseCones[i].visible = (coneCount >= 5);
    }

    // Update billboard
    const ctx = this.labelCtx;
    ctx.clearRect(0, 0, 512, 256);

    ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
    ctx.roundRect ? ctx.roundRect(10, 10, 492, 236, 16) : ctx.fillRect(10, 10, 492, 236);
    ctx.fill();

    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 4;
    ctx.stroke();

    ctx.fillStyle = '#38bdf8';
    ctx.font = 'bold 26px sans-serif';
    ctx.fillText('VOXEL CONE TRACING DIAGRAM', 30, 50);

    ctx.fillStyle = '#f8fafc';
    ctx.font = '19px monospace';
    ctx.fillText(`Cones: 1 Normal + 4 Hemispherical + 1 Specular`, 30, 90);
    ctx.fillText(`Aperture: r(d) = 2 · d · tan(α / 2)`, 30, 122);
    ctx.fillText(`LOD Sampling: lod = log2(diameter / cellSize)`, 30, 154);

    ctx.fillStyle = '#4ade80';
    ctx.font = 'bold 20px monospace';
    ctx.fillText(`Indirect GI & Glossy Reflections in Real-Time`, 30, 192);

    ctx.fillStyle = '#facc15';
    ctx.font = 'italic 16px sans-serif';
    ctx.fillText('• Marches through 3D mipmapped voxel grid with expanding cones', 30, 225);

    this.labelTexture.needsUpdate = true;
  }
}
