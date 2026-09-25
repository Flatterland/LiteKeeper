import * as THREE from 'three';

export class PhongDiagram {
  constructor() {
    this.group = new THREE.Group();
    this.group.name = "PhongDiagram";

    this.origin = new THREE.Vector3(1.2, 1.1, 0.4);
    this.group.position.copy(this.origin);

    this.initGeometry();
  }

  initGeometry() {
    // 1. Curved surface patch representation
    const curveGeo = new THREE.CylinderGeometry(1.2, 1.2, 0.4, 24, 4, true, -Math.PI / 4, Math.PI / 2);
    curveGeo.rotateX(Math.PI / 2);
    const curveMat = new THREE.MeshBasicMaterial({
      color: 0x1e293b,
      wireframe: true,
      side: THREE.DoubleSide
    });
    this.surfaceMesh = new THREE.Mesh(curveGeo, curveMat);
    this.group.add(this.surfaceMesh);

    // Focal fragment point P
    this.pointP = new THREE.Vector3(0, 0, 0.0);
    const dotGeo = new THREE.SphereGeometry(0.06, 16, 16);
    const dotMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
    const dotMesh = new THREE.Mesh(dotGeo, dotMat);
    dotMesh.position.copy(this.pointP);
    this.group.add(dotMesh);

    // Arrows:
    // Normal (N)
    this.arrowN = new THREE.ArrowHelper(new THREE.Vector3(0, 0, 1), this.pointP, 1.2, 0x00f0ff, 0.25, 0.12);
    this.group.add(this.arrowN);

    // Light (L)
    this.arrowL = new THREE.ArrowHelper(new THREE.Vector3(0.5, 0.8, 0.5).normalize(), this.pointP, 1.2, 0xfacc15, 0.25, 0.12);
    this.group.add(this.arrowL);

    // View (V)
    this.arrowV = new THREE.ArrowHelper(new THREE.Vector3(-0.3, 0.4, 0.9).normalize(), this.pointP, 1.2, 0xffffff, 0.25, 0.12);
    this.group.add(this.arrowV);

    // Reflection (R)
    this.arrowR = new THREE.ArrowHelper(new THREE.Vector3(-0.5, -0.8, 0.5).normalize(), this.pointP, 1.2, 0xe879f9, 0.25, 0.12);
    this.group.add(this.arrowR);

    // Halfway (H)
    this.arrowH = new THREE.ArrowHelper(new THREE.Vector3(0, 0.5, 1).normalize(), this.pointP, 1.0, 0xf97316, 0.2, 0.1);
    this.group.add(this.arrowH);

    // 3D Specular Lobe / Cone around R
    const coneGeo = new THREE.ConeGeometry(0.4, 1.0, 24, 1, true);
    coneGeo.translate(0, 0.5, 0);
    coneGeo.rotateX(Math.PI / 2);
    this.coneMat = new THREE.MeshBasicMaterial({
      color: 0xe879f9,
      transparent: true,
      opacity: 0.35,
      side: THREE.DoubleSide,
      wireframe: false
    });
    this.specularCone = new THREE.Mesh(coneGeo, this.coneMat);
    this.group.add(this.specularCone);

    // Billboard Canvas
    this.labelCanvas = document.createElement('canvas');
    this.labelCanvas.width = 512;
    this.labelCanvas.height = 256;
    this.labelCtx = this.labelCanvas.getContext('2d');
    this.labelTexture = new THREE.CanvasTexture(this.labelCanvas);

    const spriteMat = new THREE.SpriteMaterial({ map: this.labelTexture, transparent: true });
    this.labelSprite = new THREE.Sprite(spriteMat);
    this.labelSprite.position.set(0, -0.65, 0);
    this.labelSprite.scale.set(1.35, 0.68, 1.0);
    this.group.add(this.labelSprite);
  }

  update(lightWorldPos, camera, time, options = {}) {
    const worldP = this.origin.clone().add(this.pointP);
    const N = new THREE.Vector3(0, 0, 1);

    const L = lightWorldPos.clone().sub(worldP).normalize();
    const V = camera.position.clone().sub(worldP).normalize();
    const R = L.clone().negate().reflect(N).normalize();
    const H = L.clone().add(V).normalize();

    this.arrowN.setDirection(N);
    this.arrowL.setDirection(L);
    this.arrowV.setDirection(V);
    this.arrowR.setDirection(R);
    this.arrowH.setDirection(H);

    // Align specular cone with R
    const quat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), R);
    this.specularCone.quaternion.copy(quat);

    // Shininess controls cone radius
    const shininess = options.shininess || 64.0;
    const coneRadius = Math.max(0.08, 1.2 / Math.sqrt(shininess));
    this.specularCone.scale.set(coneRadius, coneRadius, 1.0);

    // Specular factor
    const RdotV = Math.max(0, R.dot(V));
    const NdotH = Math.max(0, N.dot(H));
    const spec = Math.pow(RdotV, shininess);

    // Canvas Label
    const ctx = this.labelCtx;
    ctx.clearRect(0, 0, 512, 256);

    ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
    ctx.roundRect ? ctx.roundRect(10, 10, 492, 236, 16) : ctx.fillRect(10, 10, 492, 236);
    ctx.fill();

    ctx.strokeStyle = '#e879f9';
    ctx.lineWidth = 4;
    ctx.stroke();

    ctx.fillStyle = '#f0abfc';
    ctx.font = 'bold 26px sans-serif';
    ctx.fillText('PHONG / BLINN-PHONG DIAGRAM', 30, 50);

    ctx.fillStyle = '#f8fafc';
    ctx.font = '19px monospace';
    ctx.fillText(`Normal (N): (0, 0, 1)  [Per-Pixel]`, 30, 88);
    ctx.fillText(`Reflect(R): (${R.x.toFixed(2)}, ${R.y.toFixed(2)}, ${R.z.toFixed(2)})`, 30, 118);
    ctx.fillText(`View   (V): (${V.x.toFixed(2)}, ${V.y.toFixed(2)}, ${V.z.toFixed(2)})`, 30, 148);

    ctx.fillStyle = '#facc15';
    ctx.font = 'bold 21px monospace';
    ctx.fillText(`(R · V)^s = ${RdotV.toFixed(2)}^${shininess.toFixed(0)} = ${spec.toFixed(3)}`, 30, 185);

    ctx.fillStyle = '#38bdf8';
    ctx.font = 'italic 16px sans-serif';
    ctx.fillText('• Smooth highlight evaluated per fragment via reflection lobe', 30, 222);

    this.labelTexture.needsUpdate = true;
  }
}
