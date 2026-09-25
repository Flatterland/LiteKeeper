import * as THREE from 'three';

export class RayTracingDiagram {
  constructor() {
    this.group = new THREE.Group();
    this.group.name = "RayTracingDiagram";

    // Anchor in open left-center space
    this.origin = new THREE.Vector3(0.0, 1.35, 0.2);
    this.group.position.copy(this.origin);

    this.initGeometry();
  }

  initGeometry() {
    // 1. Primary hit point P1
    this.p1 = new THREE.Vector3(0.0, 0.0, 0.6);
    this.hitDot1 = new THREE.Mesh(
      new THREE.SphereGeometry(0.06, 16, 16),
      new THREE.MeshBasicMaterial({ color: 0x38bdf8 })
    );
    this.hitDot1.position.copy(this.p1);
    this.group.add(this.hitDot1);

    // 2. Primary Ray (Camera -> P1)
    this.primaryLineGeo = new THREE.BufferGeometry();
    this.primaryLineMat = new THREE.LineBasicMaterial({ color: 0x00f0ff, linewidth: 2 });
    this.primaryLine = new THREE.Line(this.primaryLineGeo, this.primaryLineMat);
    this.group.add(this.primaryLine);

    // 3. Shadow Ray (P1 -> Light)
    this.shadowLineGeo = new THREE.BufferGeometry();
    this.shadowLineMat = new THREE.LineDashedMaterial({
      color: 0xfacc15,
      linewidth: 2,
      dashSize: 0.1,
      gapSize: 0.05
    });
    this.shadowLine = new THREE.Line(this.shadowLineGeo, this.shadowLineMat);
    this.group.add(this.shadowLine);

    // 4. Bounce 1 Ray (P1 -> Wall/Secondary sphere P2)
    this.bounce1LineGeo = new THREE.BufferGeometry();
    this.bounce1LineMat = new THREE.LineBasicMaterial({ color: 0x4ade80, linewidth: 2 });
    this.bounce1Line = new THREE.Line(this.bounce1LineGeo, this.bounce1LineMat);
    this.group.add(this.bounce1Line);

    this.p2 = new THREE.Vector3(-1.8, 0.0, -0.4);
    this.hitDot2 = new THREE.Mesh(
      new THREE.SphereGeometry(0.06, 16, 16),
      new THREE.MeshBasicMaterial({ color: 0x4ade80 })
    );
    this.hitDot2.position.copy(this.p2);
    this.group.add(this.hitDot2);

    // 5. Bounce 2 Ray (P2 -> Floor P3)
    this.bounce2LineGeo = new THREE.BufferGeometry();
    this.bounce2LineMat = new THREE.LineBasicMaterial({ color: 0xfb923c, linewidth: 2 });
    this.bounce2Line = new THREE.Line(this.bounce2LineGeo, this.bounce2LineMat);
    this.group.add(this.bounce2Line);

    this.p3 = new THREE.Vector3(-0.6, -1.0, -1.2);
    this.hitDot3 = new THREE.Mesh(
      new THREE.SphereGeometry(0.06, 16, 16),
      new THREE.MeshBasicMaterial({ color: 0xfb923c })
    );
    this.hitDot3.position.copy(this.p3);
    this.group.add(this.hitDot3);

    // 6. Monte Carlo Tap Ray Bundle (jittered rays emerging from P1)
    this.tapLines = [];
    const tapMat = new THREE.LineBasicMaterial({ color: 0xa78bfa, transparent: true, opacity: 0.45 });
    for (let i = 0; i < 4; i++) {
      const tapGeo = new THREE.BufferGeometry();
      const tapLine = new THREE.Line(tapGeo, tapMat);
      this.group.add(tapLine);
      this.tapLines.push(tapLine);
    }

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
    const worldP1 = this.origin.clone().add(this.p1);

    // Primary ray from camera to P1
    const localCamPos = camera.position.clone().sub(this.origin);
    this.primaryLineGeo.setFromPoints([localCamPos, this.p1]);

    // Shadow ray from P1 to light
    const localLightPos = lightWorldPos.clone().sub(this.origin);
    this.shadowLineGeo.setFromPoints([this.p1, localLightPos]);
    this.shadowLine.computeLineDistances();

    // Normal at P1 is (0, 0, 1) approximately
    const N = new THREE.Vector3(0, 0, 1);
    const inRay = this.p1.clone().sub(localCamPos).normalize();
    const refl = inRay.clone().reflect(N).normalize();

    // Bounce 1 target (adjust dynamically towards red wall)
    this.p2.set(-2.0, 0.2 + Math.sin(time * 0.5) * 0.2, -0.2);
    this.hitDot2.position.copy(this.p2);
    this.bounce1LineGeo.setFromPoints([this.p1, this.p2]);

    // Bounce 2 target
    this.p3.set(-0.8, -1.0, -1.5);
    this.hitDot3.position.copy(this.p3);
    this.bounce2LineGeo.setFromPoints([this.p2, this.p3]);

    // Bounces visibility based on options
    const bounceCount = options.bounceCount || 3;
    this.bounce1Line.visible = (bounceCount >= 2);
    this.hitDot2.visible = (bounceCount >= 2);
    this.bounce2Line.visible = (bounceCount >= 3);
    this.hitDot3.visible = (bounceCount >= 3);

    // Jittered tap rays emerging from P1
    for (let i = 0; i < this.tapLines.length; i++) {
      const angle = (i * Math.PI * 0.5) + time;
      const tapEnd = this.p1.clone().add(new THREE.Vector3(
        Math.cos(angle) * 0.7,
        Math.sin(angle) * 0.7 + 0.4,
        0.8
      ));
      this.tapLines[i].geometry.setFromPoints([this.p1, tapEnd]);
    }

    // Canvas Label
    const ctx = this.labelCtx;
    ctx.clearRect(0, 0, 512, 256);

    ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
    ctx.roundRect ? ctx.roundRect(10, 10, 492, 236, 16) : ctx.fillRect(10, 10, 492, 236);
    ctx.fill();

    ctx.strokeStyle = '#a855f7';
    ctx.lineWidth = 4;
    ctx.stroke();

    ctx.fillStyle = '#c084fc';
    ctx.font = 'bold 26px sans-serif';
    ctx.fillText('PATH / RAY TRACING DIAGRAM', 30, 50);

    ctx.fillStyle = '#f8fafc';
    ctx.font = '19px monospace';
    ctx.fillText(`Primary Ray (Blue)  → Surface Hit P1`, 30, 88);
    ctx.fillText(`Shadow Ray  (Yellow)→ Light Occlusion Test`, 30, 118);
    ctx.fillText(`Indirect Rays(Green/Orange) → ${bounceCount} Bounces`, 30, 148);

    ctx.fillStyle = '#facc15';
    ctx.font = 'bold 20px monospace';
    ctx.fillText(`Lo(p,ωo) = Le + ∫ fr·Li·(n·ωi) dωi`, 30, 185);

    ctx.fillStyle = '#38bdf8';
    ctx.font = 'italic 16px sans-serif';
    ctx.fillText('• Monte Carlo path integration with soft penumbra shadows', 30, 222);

    this.labelTexture.needsUpdate = true;
  }
}
