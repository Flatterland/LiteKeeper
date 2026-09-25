export class UIManager {
  constructor(app) {
    this.app = app;

    // References to DOM elements
    this.techniqueButtons = document.querySelectorAll('.tech-btn');
    this.meshSelect = document.getElementById('meshSelect');
    this.wipeToggleBtn = document.getElementById('wipeToggleBtn');
    this.diagramToggleBtn = document.getElementById('diagramToggleBtn');
    this.resetCamBtn = document.getElementById('resetCamBtn');

    this.debugPassSelect = document.getElementById('debugPassSelect');
    this.dynamicSlidersContainer = document.getElementById('dynamicSliders');
    this.theoryTitle = document.getElementById('theoryTitle');
    this.theoryContent = document.getElementById('theoryContent');

    // Wipe compare selectors
    this.wipeControls = document.getElementById('wipeControls');
    this.leftTechSelect = document.getElementById('leftTechSelect');
    this.rightTechSelect = document.getElementById('rightTechSelect');

    // Light controls
    this.lightColorInput = document.getElementById('lightColorInput');
    this.lightIntensitySlider = document.getElementById('lightIntensitySlider');
    this.lightIntensityVal = document.getElementById('lightIntensityVal');
    this.lightPosX = document.getElementById('lightPosX');
    this.lightPosY = document.getElementById('lightPosY');
    this.lightPosZ = document.getElementById('lightPosZ');

    this.initEventListeners();
    this.updateUIForTechnique(this.app.currentTechnique);
  }

  initEventListeners() {
    // 1. Technique Selection Buttons
    this.techniqueButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const tech = btn.dataset.tech;
        this.app.setTechnique(tech);
        this.techniqueButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.updateUIForTechnique(tech);
      });
    });

    // 2. Mesh Selection
    if (this.meshSelect) {
      this.meshSelect.addEventListener('change', (e) => {
        this.app.sceneManager.setMeshType(e.target.value);
      });
    }

    // 3. Wipe Compare Toggle
    if (this.wipeToggleBtn) {
      this.wipeToggleBtn.addEventListener('click', () => {
        const isEnabled = !this.app.wipeComparator.enabled;
        this.app.setWipeMode(isEnabled);
        this.wipeToggleBtn.classList.toggle('active', isEnabled);
        if (this.wipeControls) {
          this.wipeControls.classList.toggle('hidden', !isEnabled);
        }
      });
    }

    // Left & Right compare selectors
    if (this.leftTechSelect) {
      this.leftTechSelect.addEventListener('change', (e) => {
        this.app.setLeftCompareTechnique(e.target.value);
      });
    }
    if (this.rightTechSelect) {
      this.rightTechSelect.addEventListener('change', (e) => {
        this.app.setRightCompareTechnique(e.target.value);
      });
    }

    // 4. Diagram Toggle
    if (this.diagramToggleBtn) {
      this.diagramToggleBtn.addEventListener('click', () => {
        const visible = !this.app.diagramManager.visible;
        this.app.diagramManager.setVisible(visible);
        this.diagramToggleBtn.classList.toggle('active', visible);
      });
    }

    // 5. Reset Camera
    if (this.resetCamBtn) {
      this.resetCamBtn.addEventListener('click', () => {
        this.app.sceneManager.resetCamera();
      });
    }

    // 6. Debug Pass Selection
    if (this.debugPassSelect) {
      this.debugPassSelect.addEventListener('change', (e) => {
        const passIndex = parseInt(e.target.value, 10);
        this.app.setDebugPass(passIndex);
      });
    }

    // 7. Light Controls
    if (this.lightColorInput) {
      this.lightColorInput.addEventListener('input', (e) => {
        this.app.lightController.setColor(e.target.value);
      });
    }

    if (this.lightIntensitySlider) {
      this.lightIntensitySlider.addEventListener('input', (e) => {
        const val = parseFloat(e.target.value);
        this.lightIntensityVal.textContent = val.toFixed(1);
        this.app.lightController.setIntensity(val);
      });
    }

    // Light coordinate sliders
    const updateLightPosFromInputs = () => {
      const x = parseFloat(this.lightPosX.value);
      const y = parseFloat(this.lightPosY.value);
      const z = parseFloat(this.lightPosZ.value);
      this.app.lightController.setPosition(new THREE.Vector3(x, y, z));
    };

    [this.lightPosX, this.lightPosY, this.lightPosZ].forEach(slider => {
      if (slider) slider.addEventListener('input', updateLightPosFromInputs);
    });
  }

  updateLightCoordinates(pos) {
    if (this.lightPosX) this.lightPosX.value = pos.x.toFixed(2);
    if (this.lightPosY) this.lightPosY.value = pos.y.toFixed(2);
    if (this.lightPosZ) this.lightPosZ.value = pos.z.toFixed(2);
    const xVal = document.getElementById('lightPosXVal');
    const yVal = document.getElementById('lightPosYVal');
    const zVal = document.getElementById('lightPosZVal');
    if (xVal) xVal.textContent = pos.x.toFixed(1);
    if (yVal) yVal.textContent = pos.y.toFixed(1);
    if (zVal) zVal.textContent = pos.z.toFixed(1);
  }

  updateUIForTechnique(techKey) {
    // 1. Populate Debug Pass Dropdown
    this.populateDebugDropdown(techKey);

    // 2. Generate Technique-Specific Sliders
    this.generateSliders(techKey);

    // 3. Update Educational Theory Card
    this.updateTheoryCard(techKey);
  }

  populateDebugDropdown(techKey) {
    if (!this.debugPassSelect) return;
    this.debugPassSelect.innerHTML = '';

    const debugOptions = {
      flat: [
        { val: 0, text: 'Final Combined' },
        { val: 1, text: 'Face Normals (RGB)' },
        { val: 2, text: 'Wireframe / Facets' },
        { val: 3, text: 'Pure Diffuse (N · L)' },
        { val: 4, text: 'Incident Angle Heatmap (θ)' }
      ],
      gouraud: [
        { val: 0, text: 'Final Combined' },
        { val: 1, text: 'Interpolated Vertex Normals' },
        { val: 2, text: 'Raw Vertex Lighting Colors' },
        { val: 3, text: 'Tessellation Wireframe' },
        { val: 4, text: 'Specular Loss Highlight Map' }
      ],
      phong: [
        { val: 0, text: 'Final Combined' },
        { val: 1, text: 'World Normals (Per-Fragment)' },
        { val: 2, text: 'Pure Diffuse (N · L)' },
        { val: 3, text: 'Pure Specular Highlight' },
        { val: 4, text: 'Ambient Pass' },
        { val: 5, text: 'N · L Dot Product Heatmap' }
      ],
      vct: [
        { val: 0, text: 'Final Combined (Direct + GI + Spec)' },
        { val: 1, text: '3D Voxel Grid Slices & Occupancy' },
        { val: 2, text: 'Direct Light Only' },
        { val: 3, text: 'Indirect Diffuse GI (Wall Color Bleed)' },
        { val: 4, text: 'Indirect Specular Reflection Cone' },
        { val: 5, text: 'Voxel Ambient Occlusion (AO)' }
      ],
      raytracing: [
        { val: 0, text: 'Final Combined Path Traced' },
        { val: 1, text: 'Direct Illumination + Soft Shadows' },
        { val: 2, text: 'Bounce 1 Indirect GI' },
        { val: 3, text: 'Multi-Bounce (2+) Indirect' },
        { val: 4, text: 'G-Buffer Normals & Albedo' },
        { val: 5, text: 'Ray Traversal Heatmap (Cost)' },
        { val: 6, text: 'Noise / Variance Pass' }
      ]
    };

    const options = debugOptions[techKey] || debugOptions.flat;
    options.forEach(opt => {
      const el = document.createElement('option');
      el.value = opt.val;
      el.textContent = opt.text;
      this.debugPassSelect.appendChild(el);
    });
  }

  generateSliders(techKey) {
    if (!this.dynamicSlidersContainer) return;
    this.dynamicSlidersContainer.innerHTML = '';

    const createSliderRow = (id, label, min, max, step, val, onChange) => {
      const row = document.createElement('div');
      row.className = 'slider-row';
      row.innerHTML = `
        <div class="slider-header">
          <label for="${id}">${label}</label>
          <span id="${id}Val" class="slider-val">${val}</span>
        </div>
        <input type="range" id="${id}" min="${min}" max="${max}" step="${step}" value="${val}">
      `;
      const input = row.querySelector('input');
      const valDisplay = row.querySelector('.slider-val');
      input.addEventListener('input', (e) => {
        valDisplay.textContent = e.target.value;
        onChange(parseFloat(e.target.value));
      });
      this.dynamicSlidersContainer.appendChild(row);
    };

    const createToggleRow = (id, label, checked, onChange) => {
      const row = document.createElement('div');
      row.className = 'toggle-row';
      row.innerHTML = `
        <label for="${id}">${label}</label>
        <label class="switch">
          <input type="checkbox" id="${id}" ${checked ? 'checked' : ''}>
          <span class="slider round"></span>
        </label>
      `;
      row.querySelector('input').addEventListener('change', (e) => {
        onChange(e.target.checked);
      });
      this.dynamicSlidersContainer.appendChild(row);
    };

    const mats = this.app.sceneManager.materials;

    if (techKey === 'flat') {
      const mat = mats.flat;
      createSliderRow('flatRoughness', 'Facet Roughness', 0.0, 1.0, 0.05, mat.uniforms.uRoughness.value, v => {
        mat.uniforms.uRoughness.value = v;
      });
      createSliderRow('flatAmbient', 'Ambient Intensity', 0.0, 1.0, 0.05, mat.uniforms.uAmbientIntensity.value, v => {
        mat.uniforms.uAmbientIntensity.value = v;
      });
    } else if (techKey === 'gouraud') {
      const mat = mats.gouraud;
      // Subdivision slider: crucial to show how tessellation resolves Gouraud's artifacts!
      createSliderRow('gouraudSubdiv', 'Mesh Subdivisions (Tessellation)', 0, 4, 1, this.app.sceneManager.gouraudSubdivisions, v => {
        this.app.sceneManager.setGouraudSubdivisions(v);
      });
      createSliderRow('gouraudShininess', 'Specular Shininess', 4, 128, 4, mat.uniforms.uShininess.value, v => {
        mat.uniforms.uShininess.value = v;
        if (this.app.diagramManager.diagrams.gouraud) {
          this.app.diagramManager.diagrams.gouraud.shininess = v;
        }
      });
      createSliderRow('gouraudSpecInt', 'Specular Intensity', 0.0, 2.5, 0.1, mat.uniforms.uSpecularIntensity.value, v => {
        mat.uniforms.uSpecularIntensity.value = v;
      });
      createSliderRow('gouraudAmbient', 'Ambient Intensity', 0.0, 1.0, 0.05, mat.uniforms.uAmbientIntensity.value, v => {
        mat.uniforms.uAmbientIntensity.value = v;
      });
    } else if (techKey === 'phong') {
      const mat = mats.phong;
      createSliderRow('phongShininess', 'Specular Power (Shininess)', 4, 256, 4, mat.uniforms.uShininess.value, v => {
        mat.uniforms.uShininess.value = v;
      });
      createSliderRow('phongSpecInt', 'Specular Intensity', 0.0, 3.0, 0.1, mat.uniforms.uSpecularIntensity.value, v => {
        mat.uniforms.uSpecularIntensity.value = v;
      });
      createSliderRow('phongDiffInt', 'Diffuse Intensity', 0.0, 2.0, 0.1, mat.uniforms.uDiffuseIntensity.value, v => {
        mat.uniforms.uDiffuseIntensity.value = v;
      });
      createSliderRow('phongDecay', 'Light Attenuation Falloff', 0.0, 1.0, 0.05, mat.uniforms.uLightDecay.value, v => {
        mat.uniforms.uLightDecay.value = v;
      });
      createToggleRow('phongBlinnToggle', 'Use Blinn-Phong Model (Halfway H)', mat.uniforms.uIsBlinn.value === 1, checked => {
        mat.uniforms.uIsBlinn.value = checked ? 1 : 0;
      });
    } else if (techKey === 'vct') {
      const mat = mats.vct;
      createSliderRow('vctConeCount', 'Diffuse Cones Count', 1, 9, 1, mat.uniforms.uConeCount.value, v => {
        mat.uniforms.uConeCount.value = v;
      });
      createSliderRow('vctAperture', 'Cone Aperture Angle (tan α/2)', 0.15, 1.0, 0.05, mat.uniforms.uConeAperture.value, v => {
        mat.uniforms.uConeAperture.value = v;
      });
      createSliderRow('vctResolution', 'Voxel Resolution', 16, 64, 16, mat.uniforms.uVoxelResolution.value, v => {
        mat.uniforms.uVoxelResolution.value = v;
      });
      createSliderRow('vctGiBoost', 'Indirect GI Color Bleed', 0.0, 3.0, 0.1, mat.uniforms.uGiBoost.value, v => {
        mat.uniforms.uGiBoost.value = v;
      });
      createSliderRow('vctRoughness', 'Specular Cone Roughness', 0.02, 0.8, 0.02, mat.uniforms.uSpecularRoughness.value, v => {
        mat.uniforms.uSpecularRoughness.value = v;
      });
      createSliderRow('vctAoFactor', 'Voxel Ambient Occlusion', 0.0, 2.0, 0.1, mat.uniforms.uAoFactor.value, v => {
        mat.uniforms.uAoFactor.value = v;
      });
    } else if (techKey === 'raytracing') {
      const mat = mats.raytracing;
      createSliderRow('rtBounces', 'Ray Bounce Count', 1, 4, 1, mat.uniforms.uBounceCount.value, v => {
        mat.uniforms.uBounceCount.value = v;
      });
      createSliderRow('rtSamples', 'Samples Per Pixel (Taps)', 1, 16, 1, mat.uniforms.uSamplesPerPixel.value, v => {
        mat.uniforms.uSamplesPerPixel.value = v;
      });
      createSliderRow('rtRoughness', 'Surface Roughness', 0.0, 1.0, 0.05, mat.uniforms.uRoughness.value, v => {
        mat.uniforms.uRoughness.value = v;
      });
      createSliderRow('rtShadowSoft', 'Light Radius (Soft Shadows)', 0.05, 0.6, 0.05, mat.uniforms.uLightRadius.value, v => {
        mat.uniforms.uLightRadius.value = v;
      });
      createSliderRow('rtMaxDist', 'Max Ray Distance', 5.0, 30.0, 1.0, mat.uniforms.uMaxDistance.value, v => {
        mat.uniforms.uMaxDistance.value = v;
      });
    }
  }

  updateTheoryCard(techKey) {
    if (!this.theoryTitle || !this.theoryContent) return;

    const info = {
      flat: {
        title: 'Flat Shading',
        body: `
          <div class="theory-equation"><i>I</i> = <i>k</i><sub>a</sub><i>I</i><sub>a</sub> + <i>k</i><sub>d</sub> max(0, <b>N</b><sub>face</sub> &middot; <b>L</b>) <i>I</i><sub>d</sub></div>
          <p><strong>Mechanism:</strong> A single surface normal is calculated for each polygonal face. Illumination is evaluated once per polygon and painted uniformly across its area.</p>
          <ul>
            <li><strong>Pros:</strong> Extremely low computational cost; iconic retro aesthetic.</li>
            <li><strong>Cons:</strong> Sharp facet boundaries; cannot represent smooth curvature regardless of lighting resolution.</li>
            <li><strong>3D Diagram:</strong> Notice the single cyan normal vector <b>N</b> at the triangle centroid with uniform color disc.</li>
          </ul>
        `
      },
      gouraud: {
        title: 'Gouraud Shading (1971)',
        body: `
          <div class="theory-equation"><i>C</i><sub>pixel</sub> = <i>u</i><i>C</i><sub>V0</sub> + <i>v</i><i>C</i><sub>V1</sub> + <i>w</i><i>C</i><sub>V2</sub></div>
          <p><strong>Mechanism:</strong> Lighting equations are computed <em>strictly at the mesh vertices</em> in the vertex shader. The rasterizer then linearly interpolates the resulting RGB colors across each triangle.</p>
          <ul>
            <li><strong>Pros:</strong> Smooth appearance at vertex-only calculation overhead.</li>
            <li><strong>Artifacts:</strong> Mach banding; highlights in the middle of polygons disappear if vertices don't catch the reflection cone!</li>
            <li><strong>Experiment:</strong> Adjust the <em>Mesh Subdivisions</em> slider above to see how tessellation mitigates Gouraud artifacts!</li>
          </ul>
        `
      },
      phong: {
        title: 'Phong / Blinn-Phong Shading (1975)',
        body: `
          <div class="theory-equation"><i>I</i> = <i>k</i><sub>a</sub><i>I</i><sub>a</sub> + <i>k</i><sub>d</sub>(<b>N</b> &middot; <b>L</b>)<i>I</i><sub>d</sub> + <i>k</i><sub>s</sub>(<b>R</b> &middot; <b>V</b>)<sup><i>s</i></sup><i>I</i><sub>s</sub></div>
          <p><strong>Mechanism:</strong> Normal vectors are smoothly interpolated across the polygon surface, and the full illumination equation is evaluated <em>independently per pixel</em> in the fragment shader.</p>
          <ul>
            <li><strong>Pros:</strong> Crisp, realistic specular highlights; eliminates polygon facet artifacts.</li>
            <li><strong>Blinn-Phong variant:</strong> Uses the halfway vector <b>H</b> = (<b>L</b> + <b>V</b>) / ||<b>L</b> + <b>V</b>||, avoiding reflection recalculation.</li>
            <li><strong>3D Diagram:</strong> Observe the 3D translucent specular cone lobe around reflection vector <b>R</b>!</li>
          </ul>
        `
      },
      vct: {
        title: 'Voxel Cone Tracing (VCT)',
        body: `
          <div class="theory-equation"><i>C</i><sub>accum</sub> += (1 - &alpha;) &middot; <i>C</i><sub>voxel</sub>(LOD) &middot; &alpha;<sub>voxel</sub></div>
          <p><strong>Mechanism:</strong> The 3D scene is voxelized into a hierarchical 3D radiance grid. From surface hit points, wide cones are marched through the voxel grid, sampling wider LODs as distance increases.</p>
          <ul>
            <li><strong>Capabilities:</strong> Real-time diffuse Global Illumination (red and green wall color bleeding), soft contact shadows (AO), and glossy specular reflections.</li>
            <li><strong>3D Diagram:</strong> Displays 1 normal cone, 4 hemispherical cones, and 1 specular reflection cone stepping through voxel cells!</li>
          </ul>
        `
      },
      raytracing: {
        title: 'Monte Carlo Ray / Path Tracing',
        body: `
          <div class="theory-equation"><i>L</i><sub>o</sub>(<i>p</i>, <b>&omega;</b><sub>o</sub>) = <i>L</i><sub>e</sub> + &int;<sub>&Omega;</sub> <i>f</i><sub>r</sub>(<i>p</i>, <b>&omega;</b><sub>i</sub>, <b>&omega;</b><sub>o</sub>) <i>L</i><sub>i</sub>(<i>p</i>, <b>&omega;</b><sub>i</sub>) (<b>n</b> &middot; <b>&omega;</b><sub>i</sub>) d<b>&omega;</b><sub>i</sub></div>
          <p><strong>Mechanism:</strong> Traces simulated light rays from the camera into the scene. Rays bounce across multiple surfaces, testing direct shadow occlusion and gathering indirect radiance.</p>
          <ul>
            <li><strong>Capabilities:</strong> Physically accurate multi-bounce reflections, soft penumbra shadows, and full global illumination transport.</li>
            <li><strong>Sliders:</strong> Increase <em>Bounce Count</em> to observe multi-bounce indirect light, and increase <em>Samples (Taps)</em> for cleaner integration!</li>
          </ul>
        `
      }
    };

    const t = info[techKey] || info.flat;
    this.theoryTitle.textContent = t.title;
    this.theoryContent.innerHTML = t.body;
  }
}
