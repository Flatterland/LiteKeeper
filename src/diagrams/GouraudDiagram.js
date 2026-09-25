import * as THREE from 'three';

export class GouraudDiagram {
  constructor() {
    this.group = new THREE.Group();
    this.group.name = "GouraudDiagram";

    this.origin = new THREE.Vector3(0.0, 1.35, 0.2);
    this.group.position.copy(this.origin);

    this.initGeometry();
  }

  initGeometry() {
    // 3 Vertices of triangle
    this.v0 = new THREE.Vector3(-0.9, -0.6, 0.0);
    this.v1 = new THREE.Vector3( 0.9, -0.6, 0.0);
    this.v2 = new THREE.Vector3( 0.0,  0.9, 0.0);

    // 3 distinct vertex normals (representing curved underlying geometry)
    this.n0 = new THREE.Vector3(-0.5, -0.3, 0.8).normalize();
    this.n1 = new THREE.Vector3( 0.5, -0.3, 0.8).normalize();
    this.n2 = new THREE.Vector3( 0.0,  0.6, 0.8).normalize();

    // Triangle with vertex colors
    const triGeo = new THREE.BufferGeometry();
    const positions = new Float32Array([
      this.v0.x, this.v0.y, this.v0.z,
      this.v1.x, this.v1.y, this.v1.z,
      this.v2.x, this.v2.y, this.v2.z
    ]);
    const colors = new Float32Array([
      0.2, 0.6, 0.9,
      0.8, 0.3, 0.2,
      0.9, 0.9, 0.2
    ]);

    triGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    this.colorAttr = new THREE.BufferAttribute(colors, 3);
    triGeo.setAttribute('color', this.colorAttr);

    const mat = new THREE.MeshBasicMaterial({
      vertexColors: true,
      side: THREE.DoubleSide
    });
    this.mesh = new THREE.Mesh(triGeo, mat);
    this.group.add(this.mesh);

    // Wireframe outline
    const wireGeo = new THREE.BufferGeometry();
    const wirePos = new Float32Array([
      this.v0.x, this.v0.y, 0.01,  this.v1.x, this.v1.y, 0.01,
      this.v1.x, this.v1.y, 0.01,  this.v2.x, this.v2.y, 0.01,
      this.v2.x, this.v2.y, 0.01,  this.v0.x, this.v0.y, 0.01
    ]);
    wireGeo.setAttribute('position', new THREE.BufferAttribute(wirePos, 3));
    this.wire = new THREE.LineSegments(wireGeo, new THREE.LineBasicMaterial({ color: 0x4ade80, linewidth: 2 }));
    this.group.add(this.wire);

    // Glowing spheres at each vertex
    this.dotMeshes = [];
    const dotGeo = new THREE.SphereGeometry(0.08, 16, 16);
    for (let i = 0; i < 3; i++) {
      const dotMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
      const dot = new THREE.Mesh(dotGeo, dotMat);
      this.group.add(dot);
      this.dotMeshes.push(dot);
    }
    this.dotMeshes[0].position.copy(this.v0);
    this.dotMeshes[1].position.copy(this.v1);
    this.dotMeshes[2].position.copy(this.v2);

    // Vertex Normal Arrows (N0, N1, N2)
    this.normalArrows = [
      new THREE.ArrowHelper(this.n0, this.v0, 0.9, 0x22c55e, 0.2, 0.1),
      new THREE.ArrowHelper(this.n1, this.v1, 0.9, 0x22c55e, 0.2, 0.1),
      new THREE.ArrowHelper(this.n2, this.v2, 0.9, 0x22c55e, 0.2, 0.1)
    ];
    this.normalArrows.forEach(a => this.group.add(a));

    // Light ray arrows (L0, L1, L2)
    this.lightArrows = [
      new THREE.ArrowHelper(new THREE.Vector3(0, 1, 0), this.v0, 0.9, 0xfacc15, 0.2, 0.1),
      new THREE.ArrowHelper(new THREE.Vector3(0, 1, 0), this.v1, 0.9, 0xfacc15, 0.2, 0.1),
      new THREE.ArrowHelper(new THREE.Vector3(0, 1, 0), this.v2, 0.9, 0xfacc15, 0.2, 0.1)
    ];
    this.lightArrows.forEach(a => this.group.add(a));

    // Canvas Billboard
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
    const worldV = [
      this.origin.clone().add(this.v0),
      this.origin.clone().add(this.v1),
      this.origin.clone().add(this.v2)
    ];

    const normals = [this.n0, this.n1, this.n2];
    const vertColors = [];
    const dots = [];

    for (let i = 0; i < 3; i++) {
      const L = lightWorldPos.clone().sub(worldV[i]).normalize();
      this.lightArrows[i].setDirection(L);
      this.lightArrows[i].setLength(1.0, 0.2, 0.1);

      const NdotL = Math.max(0, normals[i].dot(L));
      dots.push(NdotL);

      // Specular component at vertex
      const V = camera.position.clone().sub(worldV[i]).normalize();
      const R = L.clone().negate().reflect(normals[i]);
      const spec = Math.pow(Math.max(0, R.dot(V)), options.shininess || 32);

      const baseCol = options.diffuseColor || new THREE.Color(0.2, 0.6, 0.9);
      const col = baseCol.clone().multiplyScalar(NdotL * 0.8 + 0.15).addScalar(spec * 0.5);
      vertColors.push(col);

      // Update dot mesh color
      this.dotMeshes[i].material.color.copy(col);

      // Set attribute in geometry
      this.colorAttr.setXYZ(i, col.r, col.g, col.b);
    }
    this.colorAttr.needsUpdate = true;

    // Canvas Label
    const ctx = this.labelCtx;
    ctx.clearRect(0, 0, 512, 256);

    ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
    ctx.roundRect ? ctx.roundRect(10, 10, 492, 236, 16) : ctx.fillRect(10, 10, 492, 236);
    ctx.fill();

    ctx.strokeStyle = '#22c55e';
    ctx.lineWidth = 4;
    ctx.stroke();

    ctx.fillStyle = '#4ade80';
    ctx.font = 'bold 26px sans-serif';
    ctx.fillText('GOURAUD SHADING DIAGRAM', 30, 50);

    ctx.fillStyle = '#f8fafc';
    ctx.font = '20px monospace';
    ctx.fillText(`V0 color (N0·L = ${dots[0].toFixed(2)})`, 30, 90);
    ctx.fillText(`V1 color (N1·L = ${dots[1].toFixed(2)})`, 30, 122);
    ctx.fillText(`V2 color (N2·L = ${dots[2].toFixed(2)})`, 30, 154);

    ctx.fillStyle = '#facc15';
    ctx.font = 'bold 22px monospace';
    ctx.fillText(`C(u,v,w) = u·C0 + v·C1 + w·C2`, 30, 192);

    ctx.fillStyle = '#f87171';
    ctx.font = 'italic 16px sans-serif';
    ctx.fillText('• Evaluated at vertices only. Interior highlights clipped!', 30, 225);

    this.labelTexture.needsUpdate = true;
  }
}
