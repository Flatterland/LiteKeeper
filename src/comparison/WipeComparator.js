export class WipeComparator {
  constructor(renderer, container, onSplitChange) {
    this.renderer = renderer;
    this.container = container;
    this.onSplitChange = onSplitChange;

    this.enabled = false;
    this.splitRatio = 0.5; // 0.0 to 1.0
    this.leftTechnique = 'gouraud';
    this.rightTechnique = 'phong';

    this.isDragging = false;
    this.initUI();
  }

  initUI() {
    this.divider = document.createElement('div');
    this.divider.id = 'wipeDivider';
    this.divider.className = 'wipe-divider hidden';

    this.divider.innerHTML = `
      <div class="wipe-line"></div>
      <div class="wipe-handle" title="Drag to compare">
        <span class="wipe-icon">&#10094;&#10095;</span>
        <div class="wipe-labels">
          <span class="left-label">Gouraud</span>
          <span class="right-label">Phong</span>
        </div>
      </div>
    `;

    this.container.appendChild(this.divider);

    // Drag events
    const startDrag = (e) => {
      this.isDragging = true;
      document.body.classList.add('resizing');
      if (e.preventDefault) e.preventDefault();
    };

    const doDrag = (e) => {
      if (!this.isDragging) return;
      const rect = this.container.getBoundingClientRect();
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const ratio = Math.max(0.05, Math.min(0.95, (clientX - rect.left) / rect.width));
      this.setSplitRatio(ratio);
    };

    const stopDrag = () => {
      if (this.isDragging) {
        this.isDragging = false;
        document.body.classList.remove('resizing');
      }
    };

    this.divider.addEventListener('pointerdown', startDrag);
    window.addEventListener('pointermove', doDrag);
    window.addEventListener('pointerup', stopDrag);
    window.addEventListener('pointercancel', stopDrag);
  }

  setEnabled(val) {
    this.enabled = val;
    if (val) {
      this.divider.classList.remove('hidden');
      this.updateDividerPosition();
    } else {
      this.divider.classList.add('hidden');
    }
  }

  setSplitRatio(ratio) {
    this.splitRatio = ratio;
    this.updateDividerPosition();
    if (this.onSplitChange) {
      this.onSplitChange(this.splitRatio);
    }
  }

  updateDividerPosition() {
    if (!this.divider) return;
    this.divider.style.left = `${this.splitRatio * 100}%`;
  }

  setLabels(leftName, rightName) {
    this.leftTechnique = leftName;
    this.rightTechnique = rightName;
    const lEl = this.divider.querySelector('.left-label');
    const rEl = this.divider.querySelector('.right-label');
    if (lEl) lEl.textContent = leftName;
    if (rEl) rEl.textContent = rightName;
  }

  render(scene, camera, renderLeftFn, renderRightFn) {
    const gl = this.renderer.getContext();
    const width = this.renderer.domElement.clientWidth;
    const height = this.renderer.domElement.clientHeight;

    if (!this.enabled) {
      this.renderer.setScissorTest(false);
      this.renderer.setViewport(0, 0, width, height);
      renderLeftFn();
      return;
    }

    const splitPx = Math.floor(width * this.splitRatio);

    this.renderer.setScissorTest(true);

    // Left Pass
    this.renderer.setScissor(0, 0, splitPx, height);
    this.renderer.setViewport(0, 0, width, height);
    renderLeftFn();

    // Right Pass
    this.renderer.setScissor(splitPx, 0, width - splitPx, height);
    this.renderer.setViewport(0, 0, width, height);
    renderRightFn();

    this.renderer.setScissorTest(false);
  }
}
