import * as THREE from 'three';

export class LightController {
  constructor(scene, camera, domElement, onMoveCallback) {
    this.scene = scene;
    this.camera = camera;
    this.domElement = domElement;
    this.onMoveCallback = onMoveCallback;

    this.position = new THREE.Vector3(1.8, 3.2, 1.4);
    this.color = new THREE.Color(1.0, 0.95, 0.88);
    this.intensity = 1.8;

    this.isDragging = false;
    this.isHovered = false;
    this.dragPlane = new THREE.Plane();
    this.planeIntersect = new THREE.Vector3();
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();
    this.offset = new THREE.Vector3();

    this.initVisuals();
    this.setupEventListeners();
  }

  initVisuals() {
    this.group = new THREE.Group();
    this.group.name = "LightGizmoGroup";
    this.group.position.copy(this.position);

    // 1. Core Light Bulb (Emissive)
    const bulbGeo = new THREE.SphereGeometry(0.18, 32, 32);
    this.bulbMat = new THREE.MeshBasicMaterial({
      color: this.color,
      wireframe: false
    });
    this.bulbMesh = new THREE.Mesh(bulbGeo, this.bulbMat);
    this.bulbMesh.userData = { isLightGizmo: true };
    this.group.add(this.bulbMesh);

    // 2. Glowing Corona Ring
    const ringGeo = new THREE.RingGeometry(0.24, 0.32, 32);
    this.ringMat = new THREE.MeshBasicMaterial({
      color: 0xffea00,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.6
    });
    this.ringMesh = new THREE.Mesh(ringGeo, this.ringMat);
    this.group.add(this.ringMesh);

    // 3. Coordinate axis handle indicators
    const axisGroup = new THREE.Group();
    const handleMat = new THREE.LineBasicMaterial({ color: 0xffd700, transparent: true, opacity: 0.4 });
    const xLine = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-0.4, 0, 0), new THREE.Vector3(0.4, 0, 0)]),
      handleMat
    );
    const yLine = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, -0.4, 0), new THREE.Vector3(0, 0.4, 0)]),
      handleMat
    );
    const zLine = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, -0.4), new THREE.Vector3(0, 0, 0.4)]),
      handleMat
    );
    axisGroup.add(xLine, yLine, zLine);
    this.group.add(axisGroup);

    this.scene.add(this.group);
  }

  setupEventListeners() {
    const getPointerPos = (e) => {
      const rect = this.domElement.getBoundingClientRect();
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;
      return {
        x: ((clientX - rect.left) / rect.width) * 2 - 1,
        y: -((clientY - rect.top) / rect.height) * 2 + 1
      };
    };

    const onPointerDown = (e) => {
      const p = getPointerPos(e);
      this.mouse.set(p.x, p.y);
      this.raycaster.setFromCamera(this.mouse, this.camera);

      const intersects = this.raycaster.intersectObject(this.bulbMesh, false);
      if (intersects.length > 0) {
        this.isDragging = true;
        this.domElement.style.cursor = 'grabbing';

        // Plane aligned with camera passing through light position
        const camDir = new THREE.Vector3();
        this.camera.getWorldDirection(camDir).negate();
        this.dragPlane.setFromNormalAndCoplanarPoint(camDir, this.position);

        if (this.raycaster.ray.intersectPlane(this.dragPlane, this.planeIntersect)) {
          this.offset.copy(this.position).sub(this.planeIntersect);
        }

        if (e.preventDefault && e.cancelable) e.preventDefault();
      }
    };

    const onPointerMove = (e) => {
      const p = getPointerPos(e);
      this.mouse.set(p.x, p.y);
      this.raycaster.setFromCamera(this.mouse, this.camera);

      if (this.isDragging) {
        if (this.raycaster.ray.intersectPlane(this.dragPlane, this.planeIntersect)) {
          const newPos = this.planeIntersect.clone().add(this.offset);
          // Clamp within Cornell room boundaries
          newPos.x = THREE.MathUtils.clamp(newPos.x, -2.6, 2.6);
          newPos.y = THREE.MathUtils.clamp(newPos.y, -0.5, 4.5);
          newPos.z = THREE.MathUtils.clamp(newPos.z, -2.6, 2.6);

          this.setPosition(newPos);
        }
      } else {
        const intersects = this.raycaster.intersectObject(this.bulbMesh, false);
        const hovered = intersects.length > 0;
        if (hovered !== this.isHovered) {
          this.isHovered = hovered;
          this.domElement.style.cursor = hovered ? 'grab' : 'default';
          this.ringMat.opacity = hovered ? 0.95 : 0.6;
          this.ringMesh.scale.setScalar(hovered ? 1.25 : 1.0);
        }
      }
    };

    const onPointerUp = () => {
      if (this.isDragging) {
        this.isDragging = false;
        this.domElement.style.cursor = this.isHovered ? 'grab' : 'default';
      }
    };

    this.domElement.addEventListener('pointerdown', onPointerDown, { passive: false });
    window.addEventListener('pointermove', onPointerMove, { passive: false });
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerUp);
  }

  setPosition(pos) {
    this.position.copy(pos);
    this.group.position.copy(pos);
    if (this.onMoveCallback) {
      this.onMoveCallback(this.position);
    }
  }

  setColor(hexColor) {
    this.color.set(hexColor);
    this.bulbMat.color.copy(this.color);
    this.ringMat.color.copy(this.color);
    if (this.onMoveCallback) {
      this.onMoveCallback(this.position);
    }
  }

  setIntensity(val) {
    this.intensity = val;
    if (this.onMoveCallback) {
      this.onMoveCallback(this.position);
    }
  }

  update(camera) {
    // Face the corona ring to the camera
    this.ringMesh.quaternion.copy(camera.quaternion);
  }
}
