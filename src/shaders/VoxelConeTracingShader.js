import * as THREE from 'three';

export const VoxelConeTracingShader = {
  uniforms: {
    uLightPos: { value: new THREE.Vector3(2, 3.5, 1.5) },
    uLightColor: { value: new THREE.Color(1.0, 0.96, 0.88) },
    uLightIntensity: { value: 1.6 },
    uAmbientColor: { value: new THREE.Color(0.08, 0.1, 0.15) },
    uDiffuseColor: { value: new THREE.Color(0.85, 0.85, 0.85) },
    uSpecularColor: { value: new THREE.Color(1.0, 1.0, 1.0) },
    uConeCount: { value: 5 }, // 1 to 9 cones
    uConeAperture: { value: 0.577 }, // tan(60 deg / 2)
    uVoxelResolution: { value: 32.0 }, // 16, 32, 64
    uStepSize: { value: 1.0 },
    uGiBoost: { value: 1.4 },
    uSpecularRoughness: { value: 0.15 },
    uAoFactor: { value: 1.0 },
    uDebugPass: { value: 0 }, // 0: Combined, 1: Voxel Slices, 2: Direct Only, 3: Indirect Diffuse GI, 4: Specular Cone, 5: Voxel AO
    uCameraPos: { value: new THREE.Vector3(0, 0, 5) },
    uTime: { value: 0.0 }
  },

  vertexShader: /* glsl */ `
    varying vec3 vNormal;
    varying vec3 vWorldPos;

    void main() {
      vec4 worldPosition = modelMatrix * vec4(position, 1.0);
      vWorldPos = worldPosition.xyz;
      vNormal = normalize(mat3(modelMatrix) * normal);
      gl_Position = projectionMatrix * viewMatrix * worldPosition;
    }
  `,

  fragmentShader: /* glsl */ `
    precision highp float;

    uniform vec3 uLightPos;
    uniform vec3 uLightColor;
    uniform float uLightIntensity;
    uniform vec3 uAmbientColor;
    uniform vec3 uDiffuseColor;
    uniform vec3 uSpecularColor;
    uniform int uConeCount;
    uniform float uConeAperture;
    uniform float uVoxelResolution;
    uniform float uStepSize;
    uniform float uGiBoost;
    uniform float uSpecularRoughness;
    uniform float uAoFactor;
    uniform int uDebugPass;
    uniform vec3 uCameraPos;
    uniform float uTime;

    varying vec3 vNormal;
    varying vec3 vWorldPos;

    // Cornell Box boundaries in world space
    const vec3 ROOM_MIN = vec3(-3.0, -1.0, -3.0);
    const vec3 ROOM_MAX = vec3(3.0, 5.0, 3.0);

    // Wall colors
    const vec3 LEFT_WALL_COLOR = vec3(0.9, 0.15, 0.15);   // Red
    const vec3 RIGHT_WALL_COLOR = vec3(0.15, 0.85, 0.25); // Green
    const vec3 BACK_WALL_COLOR = vec3(0.85, 0.85, 0.88);  // White
    const vec3 FLOOR_COLOR = vec3(0.65, 0.65, 0.7);       // Gray
    const vec3 CEIL_COLOR = vec3(0.9, 0.9, 0.92);         // White
    const vec3 SPHERE_ACCENT_COLOR = vec3(0.95, 0.75, 0.1); // Gold secondary object

    // Helper: sample procedural voxel grid at world position and LOD
    vec4 sampleVoxelScene(vec3 pos, float lod) {
      float cellSize = (ROOM_MAX.x - ROOM_MIN.x) / uVoxelResolution;
      // Snap or smooth based on lod
      float filterWidth = cellSize * pow(2.0, max(lod, 0.0));

      // Check bounds
      if (pos.x < ROOM_MIN.x || pos.x > ROOM_MAX.x ||
          pos.y < ROOM_MIN.y || pos.y > ROOM_MAX.y ||
          pos.z < ROOM_MIN.z || pos.z > ROOM_MAX.z) {
        return vec4(0.0);
      }

      // Check walls with filter width
      float dLeft = abs(pos.x - ROOM_MIN.x);
      if (dLeft < filterWidth * 1.2) {
        float directLight = max(dot(vec3(1.0, 0.0, 0.0), normalize(uLightPos - pos)), 0.0) * 0.8 + 0.2;
        return vec4(LEFT_WALL_COLOR * directLight * uLightColor, 1.0);
      }

      float dRight = abs(pos.x - ROOM_MAX.x);
      if (dRight < filterWidth * 1.2) {
        float directLight = max(dot(vec3(-1.0, 0.0, 0.0), normalize(uLightPos - pos)), 0.0) * 0.8 + 0.2;
        return vec4(RIGHT_WALL_COLOR * directLight * uLightColor, 1.0);
      }

      float dBack = abs(pos.z - ROOM_MIN.z);
      if (dBack < filterWidth * 1.2) {
        float directLight = max(dot(vec3(0.0, 0.0, 1.0), normalize(uLightPos - pos)), 0.0) * 0.8 + 0.2;
        return vec4(BACK_WALL_COLOR * directLight * uLightColor, 1.0);
      }

      float dFloor = abs(pos.y - ROOM_MIN.y);
      if (dFloor < filterWidth * 1.2) {
        float directLight = max(dot(vec3(0.0, 1.0, 0.0), normalize(uLightPos - pos)), 0.0) * 0.8 + 0.2;
        return vec4(FLOOR_COLOR * directLight * uLightColor, 1.0);
      }

      float dCeil = abs(pos.y - ROOM_MAX.y);
      if (dCeil < filterWidth * 1.2) {
        return vec4(CEIL_COLOR * 0.5, 1.0);
      }

      // Secondary scene object: glowing/metallic sphere at (-1.5, 0.2, -0.5)
      vec3 spherePos = vec3(-1.4, 0.2, -0.5);
      float dSphere = length(pos - spherePos) - 0.75;
      if (dSphere < filterWidth * 0.8) {
        return vec4(SPHERE_ACCENT_COLOR * 1.2, 1.0);
      }

      // Another secondary object: blue pedestal at (1.5, 0.0, 0.5)
      vec3 pedestalPos = vec3(1.5, -0.2, 0.5);
      float dPedestal = length(pos - pedestalPos) - 0.65;
      if (dPedestal < filterWidth * 0.8) {
        return vec4(vec3(0.1, 0.4, 0.95), 1.0);
      }

      return vec4(0.0);
    }

    // Cone Tracing function
    vec4 traceCone(vec3 origin, vec3 dir, float tanHalfAngle, float maxDist) {
      vec4 accum = vec4(0.0);
      float cellSize = (ROOM_MAX.x - ROOM_MIN.x) / uVoxelResolution;
      float dist = cellSize * 1.5; // Offset to avoid self-occlusion

      for (int i = 0; i < 28; i++) {
        if (dist >= maxDist || accum.a >= 0.95) break;

        float diameter = 2.0 * dist * tanHalfAngle;
        float lod = log2(max(diameter / cellSize, 1.0));
        vec3 samplePos = origin + dir * dist;

        vec4 voxel = sampleVoxelScene(samplePos, lod);
        if (voxel.a > 0.01) {
          // Front-to-back alpha compositing
          float weight = (1.0 - accum.a) * voxel.a;
          accum.rgb += weight * voxel.rgb;
          accum.a += weight;
        }

        dist += max(diameter * 0.5 * uStepSize, cellSize * 0.5);
      }

      return accum;
    }

    // Construct orthonormal basis around normal N
    void createBasis(vec3 N, out vec3 T, out vec3 B) {
      vec3 up = abs(N.y) < 0.999 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0);
      T = normalize(cross(up, N));
      B = cross(N, T);
    }

    void main() {
      vec3 N = normalize(vNormal);
      if (!gl_FrontFacing) N = -N;

      vec3 L = normalize(uLightPos - vWorldPos);
      vec3 V = normalize(uCameraPos - vWorldPos);
      vec3 R = reflect(-V, N);

      float distLight = length(uLightPos - vWorldPos);
      float attenuation = 1.0 / (1.0 + 0.08 * distLight + 0.03 * distLight * distLight);

      // Direct lighting
      float NdotL = max(dot(N, L), 0.0);
      vec3 directDiffuse = uDiffuseColor * uLightColor * NdotL * uLightIntensity * attenuation;

      // Construct tangent frame for diffuse cone distribution
      vec3 T, B;
      createBasis(N, T, B);

      // Diffuse Indirect Cone Tracing (GI Hemispherical gathering)
      vec3 indirectDiffuse = vec3(0.0);
      float totalWeight = 0.0;
      float totalOcclusion = 0.0;

      float tanAperture = max(uConeAperture, 0.1);

      // Cone 1: Directly along surface normal
      vec4 coneRes0 = traceCone(vWorldPos, N, tanAperture, 7.0);
      indirectDiffuse += coneRes0.rgb * 0.35;
      totalOcclusion += coneRes0.a * 0.35;
      totalWeight += 0.35;

      // Hemispherical ring cones (if coneCount >= 5)
      if (uConeCount >= 5) {
        float angleStep = 6.2831853 / 4.0;
        float elevation = 0.785398; // 45 degrees
        float cosEle = cos(elevation);
        float sinEle = sin(elevation);

        for (int i = 0; i < 4; i++) {
          float phi = float(i) * angleStep;
          vec3 coneDir = normalize(N * sinEle + (T * cos(phi) + B * sin(phi)) * cosEle);
          vec4 cRes = traceCone(vWorldPos, coneDir, tanAperture, 6.0);
          indirectDiffuse += cRes.rgb * 0.15;
          totalOcclusion += cRes.a * 0.15;
          totalWeight += 0.15;
        }
      }

      // Additional tilted ring (if coneCount >= 9)
      if (uConeCount >= 9) {
        float angleStep = 6.2831853 / 4.0;
        float elevation = 0.4; // lower angle
        float cosEle = cos(elevation);
        float sinEle = sin(elevation);

        for (int i = 0; i < 4; i++) {
          float phi = float(i) * angleStep + 0.785;
          vec3 coneDir = normalize(N * sinEle + (T * cos(phi) + B * sin(phi)) * cosEle);
          vec4 cRes = traceCone(vWorldPos, coneDir, tanAperture * 1.2, 5.0);
          indirectDiffuse += cRes.rgb * 0.1;
          totalOcclusion += cRes.a * 0.1;
          totalWeight += 0.1;
        }
      }

      indirectDiffuse = (indirectDiffuse / totalWeight) * uGiBoost * uDiffuseColor;
      float ao = clamp(1.0 - (totalOcclusion / totalWeight) * uAoFactor, 0.0, 1.0);

      // Specular Reflection Cone Tracing
      float specTanAperture = max(uSpecularRoughness * 0.7, 0.02);
      vec4 specConeRes = traceCone(vWorldPos, R, specTanAperture, 7.0);
      vec3 indirectSpecular = specConeRes.rgb * uSpecularColor * (1.0 - uSpecularRoughness);

      // Direct specular
      vec3 H = normalize(L + V);
      float directSpecFactor = pow(max(dot(N, H), 0.0), mix(128.0, 8.0, uSpecularRoughness));
      vec3 directSpecular = uSpecularColor * uLightColor * directSpecFactor * uLightIntensity * attenuation;

      // Ambient baseline
      vec3 ambient = uAmbientColor * uDiffuseColor * ao;

      // Combined
      vec3 combined = (directDiffuse + ambient + indirectDiffuse) * ao + directSpecular + indirectSpecular;

      // Debug pass handling
      if (uDebugPass == 1) {
        // Voxel Grid 3D Slices / Occupancy view
        vec3 uvw = (vWorldPos - ROOM_MIN) / (ROOM_MAX - ROOM_MIN);
        vec3 sliceGrid = fract(uvw * uVoxelResolution);
        vec3 gridLines = step(0.92, sliceGrid);
        float isGrid = max(max(gridLines.x, gridLines.y), gridLines.z);
        vec4 sampleCenter = sampleVoxelScene(vWorldPos, 0.0);
        vec3 voxelVis = mix(sampleCenter.rgb + vec3(0.05), vec3(0.1, 0.8, 1.0), isGrid);
        gl_FragColor = vec4(voxelVis, 1.0);
      } else if (uDebugPass == 2) {
        // Direct Light Only
        gl_FragColor = vec4(directDiffuse + directSpecular, 1.0);
      } else if (uDebugPass == 3) {
        // Indirect Diffuse GI Only (wall color bleed)
        gl_FragColor = vec4(indirectDiffuse, 1.0);
      } else if (uDebugPass == 4) {
        // Indirect Specular Cone Only
        gl_FragColor = vec4(indirectSpecular, 1.0);
      } else if (uDebugPass == 5) {
        // Voxel Ambient Occlusion map
        gl_FragColor = vec4(vec3(ao), 1.0);
      } else {
        // Final Combined
        gl_FragColor = vec4(combined, 1.0);
      }
    }
  `
};

export function createVoxelConeTracingMaterial(customUniforms = {}) {
  const uniforms = THREE.UniformsUtils.clone(VoxelConeTracingShader.uniforms);
  for (const key in customUniforms) {
    if (uniforms[key]) {
      uniforms[key].value = customUniforms[key];
    }
  }

  return new THREE.ShaderMaterial({
    uniforms: uniforms,
    vertexShader: VoxelConeTracingShader.vertexShader,
    fragmentShader: VoxelConeTracingShader.fragmentShader,
    side: THREE.DoubleSide
  });
}
