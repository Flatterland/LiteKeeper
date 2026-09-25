import * as THREE from 'three';

export class FlatDiagram {
  constructor() {
    this.group = new THREE.Group();
    this.group.name = "FlatDiagram";

    // Base position
    this.origin = new THREE.Vector3(1.2, 1.1, 0.4);
    this.group.position.copy(this.origin);

    this.initGeometry();
  }

  initGeometry() {
    // 1. Triangle facet
    const triGeo = new THREE.BufferGeometry();
    const vertices = new Float32Array([
      -0.8, -0.5, 0.0,
       0.8, -0.5, 0.0,
       0.0,  0.9, 0.0
    ]);
    triGeo.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
    triGeo.computeVertexNormals();

    this.facetMaterial = new THREE.MeshBasicMaterial({
      color: 0x3399ff,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.85
    });
    this.facetMesh = new THREE.Mesh(triGeo, this.facetMaterial);
    this.group.add(this.facetMesh);

    // Facet wireframe
    const wireGeo = new THREE.BufferGeometry();
    const wireVerts = new Float32Array([
      -0.8, -0.5, 0.01,   0.8, -0.5, 0.01,
       0.8, -0.5, 0.01,   0.0,  0.9, 0.01,
       0.0,  0.9, 0.01,  -0.8, -0.5, 0.01
    ]);
    wireGeo.setAttribute('position', new THREE.BufferAttribute(wireVerts, 3));
    const wireMat = new THREE.LineBasicMaterial({ color: 0x00ffff, linewidth: 2 });
    this.facetWire = new THREE.LineSegments(wireGeo, wireMat);
    this.group.add(this.facetWire);

    // Centroid marker
    this.centroid = new THREE.Vector3(0, 0, 0.02);
    const dotGeo = new THREE.SphereGeometry(0.04, 16, 16);
    const dotMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const dotMesh = new THREE.Mesh(dotGeo, dotMat);
    dotMesh.position.copy(this.centroid);
    this.group.add(dotMesh);

    // 2. Normal Vector Arrow (N)
    this.normalArrow = new THREE.ArrowHelper(
      new THREE.Vector3(0, 0, 1),
      this.centroid,
      1.2,
      0x00ffcc,
      0.25,
      0.15
    );
    this.group.add(this.normalArrow);

    // 3. Light Ray Arrow (L)
    this.lightArrow = new THREE.ArrowHelper(
      new THREE.Vector3(0.5, 0.8, 0.3).normalize(),
      this.centroid,
      1.2,
      0xffea00,
      0.25,
      0.15
    );
    this.group.add(this.lightArrow);

    // 4. Arc curve between N and L
    const arcGeo = new THREE.BufferGeometry();
    const arcMat = new THREE.LineBasicMaterial({ color: 0xffa500, linewidth: 2 });
    this.arcLine = new THREE.Line(arcGeo, arcMat);
    this.group.add(this.arcLine);

    // 5. Canvas Billboard for dynamic formula display
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
    // Normal in world space is (0, 0, 1) relative to facet
    const N = new THREE.Vector3(0, 0, 1);

    // Vector from centroid to light
    const worldCentroid = this.origin.clone().add(this.centroid);
    const L = lightWorldPos.clone().sub(worldCentroid).normalize();

    // Transform L into local coordinates of this diagram
    const localL = L.clone();

    // Update light arrow
    this.lightArrow.setDirection(localL);
    this.lightArrow.setLength(1.3, 0.25, 0.12);

    // Dot product (cos theta)
    const dotVal = Math.max(0, N.dot(localL));
    const angle = Math.acos(Math.min(1.0, Math.max(-1.0, N.dot(localL))));

    // Update color of facet based on uniform N.L
    const lightColor = options.lightColor || new THREE.Color(1, 1, 1);
    const diffuseColor = options.diffuseColor || new THREE.Color(0.2, 0.6, 0.9);
    const shade = diffuseColor.clone().multiply(lightColor).multiplyScalar(dotVal * 0.8 + 0.2);
    this.facetMaterial.color.copy(shade);

    // Update arc between N and localL
    const arcPoints = [];
    const segments = 16;
    const arcRadius = 0.6;
    for (let i = 0; i <= segments; i++) {
      const alpha = (i / segments) * angle;
      // Slerp from N to localL
      const p = new THREE.Vector3().copy(N).applyAxisAngle(
        new THREE.Vector3().crossVectors(N, localL).normalize(),
        alpha
      ).multiplyScalar(arcRadius);
      arcPoints.push(p);
    }
    this.arcLine.geometry.setFromPoints(arcPoints);

    // Render Canvas Label
    const ctx = this.labelCtx;
    ctx.clearRect(0, 0, 512, 256);

    ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
    ctx.roundRect ? ctx.roundRect(10, 10, 492, 236, 16) : ctx.fillRect(10, 10, 492, 236);
    ctx.fill();

    ctx.strokeStyle = '#00f0ff';
    ctx.lineWidth = 4;
    ctx.stroke();

    ctx.fillStyle = '#38bdf8';
    ctx.font = 'bold 26px sans-serif';
    ctx.fillText('FLAT SHADING DIAGRAM', 30, 50);

    ctx.fillStyle = '#f8fafc';
    ctx.font = '22px monospace';
    ctx.fillText(`Normal (N): (0.00, 0.00, 1.00)`, 30, 95);
    ctx.fillText(`Light  (L): (${localL.x.toFixed(2)}, ${localL.y.toFixed(2)}, ${localL.z.toFixed(2)})`, 30, 130);

    ctx.fillStyle = '#facc15';
    ctx.font = 'bold 24px monospace';
    ctx.fillText(`N · L = cos(θ) = ${dotVal.toFixed(3)}`, 30, 175);

    ctx.fillStyle = '#94a3b8';
    ctx.font = 'italic 18px sans-serif';
    ctx.fillText('• 1 Normal per face → Constant facet illumination', 30, 215);

    this.labelTexture.needsUpdate = true;
  }
}
