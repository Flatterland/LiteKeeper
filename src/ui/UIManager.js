export class UIManager {
  constructor(app) {
    this.app = app;

    this.techniqueButtons = document.querySelectorAll('.tech-btn');
    this.viewSelect = document.getElementById('viewSelect');
    this.wipeToggleBtn = document.getElementById('wipeToggleBtn');
    this.diagramToggleBtn = document.getElementById('diagramToggleBtn');
    this.resetCamBtn = document.getElementById('resetCamBtn');

    this.debugPassSelect = document.getElementById('debugPassSelect');
    this.dynamicSlidersContainer = document.getElementById('dynamicSliders');
    this.theoryTitle = document.getElementById('theoryTitle');
    this.theoryContent = document.getElementById('theoryContent');

    this.wipeControls = document.getElementById('wipeControls');
    this.leftTechSelect = document.getElementById('leftTechSelect');
    this.rightTechSelect = document.getElementById('rightTechSelect');

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
    this.techniqueButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const tech = btn.dataset.tech;
        this.app.setTechnique(tech);
        this.techniqueButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.updateUIForTechnique(tech);
      });
    });

    if (this.viewSelect) {
      this.viewSelect.addEventListener('change', (e) => {
        this.app.sceneManager.setCameraPreset(e.target.value);
      });
    }

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

    if (this.diagramToggleBtn) {
      this.diagramToggleBtn.addEventListener('click', () => {
        const visible = !this.app.diagramManager.visible;
        this.app.diagramManager.setVisible(visible);
        this.diagramToggleBtn.classList.toggle('active', visible);
      });
    }

    if (this.resetCamBtn) {
      this.resetCamBtn.addEventListener('click', () => {
        this.app.sceneManager.resetCamera();
        if (this.viewSelect) this.viewSelect.value = 'overview';
      });
    }

    if (this.debugPassSelect) {
      this.debugPassSelect.addEventListener('change', (e) => {
        const passIndex = parseInt(e.target.value, 10);
        this.app.setDebugPass(passIndex);
      });
    }

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
    this.populateDebugDropdown(techKey);
    this.generateSliders(techKey);
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

    const sm = this.app.sceneManager;

    if (techKey === 'flat') {
      const roughness = sm.getTechniqueUniform('flat', 'uRoughness') ?? 0.5;
      const ambient = sm.getTechniqueUniform('flat', 'uAmbientIntensity') ?? 0.3;
      createSliderRow('flatRoughness', 'Facet Roughness', 0.0, 1.0, 0.05, roughness, v => {
        sm.setTechniqueUniform('flat', 'uRoughness', v);
      });
      createSliderRow('flatAmbient', 'Ambient Intensity', 0.0, 1.0, 0.05, ambient, v => {
        sm.setTechniqueUniform('flat', 'uAmbientIntensity', v);
      });
    } else if (techKey === 'gouraud') {
      createSliderRow('gouraudSubdiv', 'Mesh Subdivisions (Tessellation)', 0, 4, 1, sm.subdivisions, v => {
        sm.setGouraudSubdivisions(v);
      });
      const shininess = sm.getTechniqueUniform('gouraud', 'uShininess') ?? 32;
      createSliderRow('gouraudShininess', 'Specular Shininess', 4, 128, 4, shininess, v => {
        sm.setTechniqueUniform('gouraud', 'uShininess', v);
      });
      const specInt = sm.getTechniqueUniform('gouraud', 'uSpecularIntensity') ?? 1.0;
      createSliderRow('gouraudSpecInt', 'Specular Intensity', 0.0, 2.5, 0.1, specInt, v => {
        sm.setTechniqueUniform('gouraud', 'uSpecularIntensity', v);
      });
      const ambient = sm.getTechniqueUniform('gouraud', 'uAmbientIntensity') ?? 0.3;
      createSliderRow('gouraudAmbient', 'Ambient Intensity', 0.0, 1.0, 0.05, ambient, v => {
        sm.setTechniqueUniform('gouraud', 'uAmbientIntensity', v);
      });
    } else if (techKey === 'phong') {
      const shininess = sm.getTechniqueUniform('phong', 'uShininess') ?? 64;
      createSliderRow('phongShininess', 'Specular Power (Shininess)', 4, 256, 4, shininess, v => {
        sm.setTechniqueUniform('phong', 'uShininess', v);
      });
      const specInt = sm.getTechniqueUniform('phong', 'uSpecularIntensity') ?? 1.2;
      createSliderRow('phongSpecInt', 'Specular Intensity', 0.0, 3.0, 0.1, specInt, v => {
        sm.setTechniqueUniform('phong', 'uSpecularIntensity', v);
      });
      const diffInt = sm.getTechniqueUniform('phong', 'uDiffuseIntensity') ?? 1.0;
      createSliderRow('phongDiffInt', 'Diffuse Intensity', 0.0, 2.0, 0.1, diffInt, v => {
        sm.setTechniqueUniform('phong', 'uDiffuseIntensity', v);
      });
      const decay = sm.getTechniqueUniform('phong', 'uLightDecay') ?? 0.5;
      createSliderRow('phongDecay', 'Light Attenuation Falloff', 0.0, 1.0, 0.05, decay, v => {
        sm.setTechniqueUniform('phong', 'uLightDecay', v);
      });
      const isBlinn = (sm.getTechniqueUniform('phong', 'uIsBlinn') ?? 1) === 1;
      createToggleRow('phongBlinnToggle', 'Use Blinn-Phong Model (Halfway H)', isBlinn, checked => {
        sm.setTechniqueUniform('phong', 'uIsBlinn', checked ? 1 : 0);
      });
    } else if (techKey === 'vct') {
      const coneCount = sm.getTechniqueUniform('vct', 'uConeCount') ?? 5;
      createSliderRow('vctConeCount', 'Diffuse Cones Count', 1, 9, 1, coneCount, v => {
        sm.setTechniqueUniform('vct', 'uConeCount', v);
      });
      const aperture = sm.getTechniqueUniform('vct', 'uConeAperture') ?? 0.577;
      createSliderRow('vctAperture', 'Cone Aperture Angle (tan α/2)', 0.15, 1.0, 0.05, aperture, v => {
        sm.setTechniqueUniform('vct', 'uConeAperture', v);
      });
      const res = sm.getTechniqueUniform('vct', 'uVoxelResolution') ?? 32;
      createSliderRow('vctResolution', 'Voxel Resolution', 16, 64, 16, res, v => {
        sm.setTechniqueUniform('vct', 'uVoxelResolution', v);
      });
      const gi = sm.getTechniqueUniform('vct', 'uGiBoost') ?? 1.5;
      createSliderRow('vctGiBoost', 'Indirect GI Color Bleed', 0.0, 3.0, 0.1, gi, v => {
        sm.setTechniqueUniform('vct', 'uGiBoost', v);
      });
      const rough = sm.getTechniqueUniform('vct', 'uSpecularRoughness') ?? 0.15;
      createSliderRow('vctRoughness', 'Specular Cone Roughness', 0.02, 0.8, 0.02, rough, v => {
        sm.setTechniqueUniform('vct', 'uSpecularRoughness', v);
      });
      const ao = sm.getTechniqueUniform('vct', 'uAoFactor') ?? 1.0;
      createSliderRow('vctAoFactor', 'Voxel Ambient Occlusion', 0.0, 2.0, 0.1, ao, v => {
        sm.setTechniqueUniform('vct', 'uAoFactor', v);
      });
    } else if (techKey === 'raytracing') {
      const bounces = sm.getTechniqueUniform('raytracing', 'uBounceCount') ?? 3;
      createSliderRow('rtBounces', 'Ray Bounce Count', 1, 4, 1, bounces, v => {
        sm.setTechniqueUniform('raytracing', 'uBounceCount', v);
      });
      const samples = sm.getTechniqueUniform('raytracing', 'uSamplesPerPixel') ?? 4;
      createSliderRow('rtSamples', 'Samples Per Pixel (Taps)', 1, 16, 1, samples, v => {
        sm.setTechniqueUniform('raytracing', 'uSamplesPerPixel', v);
      });
      const rough = sm.getTechniqueUniform('raytracing', 'uRoughness') ?? 0.15;
      createSliderRow('rtRoughness', 'Surface Roughness', 0.0, 1.0, 0.05, rough, v => {
        sm.setTechniqueUniform('raytracing', 'uRoughness', v);
      });
      const shadowRad = sm.getTechniqueUniform('raytracing', 'uLightRadius') ?? 0.22;
      createSliderRow('rtShadowSoft', 'Light Radius (Soft Shadows)', 0.05, 0.6, 0.05, shadowRad, v => {
        sm.setTechniqueUniform('raytracing', 'uLightRadius', v);
      });
      const maxDist = sm.getTechniqueUniform('raytracing', 'uMaxDistance') ?? 20.0;
      createSliderRow('rtMaxDist', 'Max Ray Distance', 5.0, 30.0, 1.0, maxDist, v => {
        sm.setTechniqueUniform('raytracing', 'uMaxDistance', v);
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
          <p><strong>Mechanism:</strong> A single surface normal is calculated per geometric polygon. Illumination is evaluated once per face and rendered uniformly across the facet.</p>
          <ul>
            <li><strong>Scene Comparison:</strong> Notice how the <em>Sphere</em> and <em>Cone</em> reveal prominent faceted planar bands, while the <em>Cube</em> looks identical to higher models due to its planar geometry.</li>
            <li><strong>Pros/Cons:</strong> Instantaneous rendering, but unable to represent smooth curvatures.</li>
          </ul>
        `
      },
      gouraud: {
        title: 'Gouraud Shading (1971)',
        body: `
          <div class="theory-equation"><i>C</i><sub>pixel</sub> = <i>u</i> <i>C</i><sub>V0</sub> + <i>v</i> <i>C</i><sub>V1</sub> + <i>w</i> <i>C</i><sub>V2</sub></div>
          <p><strong>Mechanism:</strong> Lighting is evaluated <em>strictly at vertices</em> in the vertex shader. The GPU rasterizer linearly interpolates vertex colors across triangle interiors.</p>
          <ul>
            <li><strong>Interactive Experiment:</strong> Drag the <strong>Mesh Subdivisions</strong> slider above! At low tessellation, highlights across the Sphere and Cone vanish because vertices miss the specular peak.</li>
            <li><strong>Artifacts:</strong> Mach banding and clipped specular highlights inside polygon centers.</li>
          </ul>
        `
      },
      phong: {
        title: 'Phong / Blinn-Phong Shading (1975)',
        body: `
          <div class="theory-equation"><i>I</i> = <i>k</i><sub>a</sub><i>I</i><sub>a</sub> + <i>k</i><sub>d</sub>(<b>N</b> &middot; <b>L</b>)<i>I</i><sub>d</sub> + <i>k</i><sub>s</sub>(<b>R</b> &middot; <b>V</b>)<sup>s</sup><i>I</i><sub>s</sub></div>
          <p><strong>Mechanism:</strong> Normal vectors are smoothly interpolated per pixel, and the complete illumination equation is computed per fragment.</p>
          <ul>
            <li><strong>Scene Behavior:</strong> Produces smooth, continuous specular glints on the Sphere and Cone regardless of triangle size.</li>
            <li><strong>Blinn-Phong variant:</strong> Uses the halfway vector <b>H</b> = (<b>L</b> + <b>V</b>) / &Vert;<b>L</b> + <b>V</b>&Vert; for faster computation.</li>
          </ul>
        `
      },
      vct: {
        title: 'Voxel Cone Tracing (VCT)',
        body: `
          <div class="theory-equation"><i>C</i><sub>accum</sub> += (1 - &alpha;) <i>C</i><sub>voxel</sub>(LOD) &middot; &alpha;<sub>voxel</sub></div>
          <p><strong>Mechanism:</strong> The Cornell room and models are voxelized into a 3D radiance field. Wide cones march through the voxel volume gathering indirect light.</p>
          <ul>
            <li><strong>Color Bleeding in the Scene:</strong> Look closely at the left of the Cube and Cone: they receive vibrant <em>Red indirect light</em> from the left wall! The right of the Sphere receives <em>Green indirect light</em> from the right wall!</li>
            <li><strong>Ambient Occlusion:</strong> Contact shadows form naturally under the models where cones are heavily occluded by neighboring voxels.</li>
          </ul>
        `
      },
      raytracing: {
        title: 'Monte Carlo Ray / Path Tracing',
        body: `
          <div class="theory-equation"><i>L</i><sub>o</sub>(<i>p</i>, &omega;<sub>o</sub>) = <i>L</i><sub>e</sub> + &int; <i>f</i><sub>r</sub> &middot; <i>L</i><sub>i</sub> (<b>n</b> &middot; &omega;<sub>i</sub>) d&omega;<sub>i</sub></div>
          <p><strong>Mechanism:</strong> Traces simulated light rays bouncing across the room, cube, sphere, cone, and walls with soft penumbra shadows and true global illumination.</p>
          <ul>
            <li><strong>Exact Scene Alignment:</strong> The Ray Tracer models the <em>exact same Cube, Sphere, Cone, and Room</em> as the rasterizer, allowing perfect side-by-side split screen wipe comparisons!</li>
            <li><strong>Bounces & Taps:</strong> Increase the <em>Bounce Count</em> slider to trace deeper indirect reflection paths.</li>
          </ul>
        `
      }
    };

    const t = info[techKey] || info.flat;
    this.theoryTitle.textContent = t.title;
    this.theoryContent.innerHTML = t.body;
  }
}
