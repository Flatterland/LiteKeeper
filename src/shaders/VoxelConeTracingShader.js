import * as THREE from 'three';

export const VoxelConeTracingShader = {
  uniforms: {
    uLightPos: { value: new THREE.Vector3(0.6, 2.5, 0.6) },
    uLightColor: { value: new THREE.Color(1.0, 0.96, 0.88) },
    uLightIntensity: { value: 1.8 },
    uAmbientColor: { value: new THREE.Color(0.08, 0.1, 0.15) },
    uDiffuseColor: { value: new THREE.Color(0.85, 0.85, 0.85) },
    uSpecularColor: { value: new THREE.Color(1.0, 1.0, 1.0) },
    uConeCount: { value: 5 }, // 1 to 9 cones
    uConeAperture: { value: 0.577 }, // tan(60 deg / 2)
    uVoxelResolution: { value: 32.0 }, // 16, 32, 64
    uStepSize: { value: 1.0 },
    uGiBoost: { value: 1.5 },
    uSpecularRoughness: { value: 0.15 },
    uAoFactor: { value: 1.0 },
    uDebugPass: { value: 0 }, // 0: Combined, 1: Voxel Slices, 2: Direct Only, 3: Indirect Diffuse GI, 4: Specular Cone, 5: Voxel AO
    uCameraPos: { value: new THREE.Vector3(0, 1.2, 4.5) },
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
    const vec3 ROOM_MIN = vec3(-2.5, -1.2, -2.5);
    const vec3 ROOM_MAX = vec3(2.5, 3.2, 2.5);

    // Wall & Model colors
    const vec3 RED_WALL   = vec3(0.9, 0.15, 0.2);
    const vec3 GREEN_WALL = vec3(0.15, 0.85, 0.3);
    const vec3 WHITE_WALL = vec3(0.9, 0.9, 0.92);
    const vec3 FLOOR_COL  = vec3(0.7, 0.7, 0.72);

    const vec3 CUBE_COLOR   = vec3(0.88, 0.88, 0.9);
    const vec3 SPHERE_COLOR = vec3(0.2, 0.7, 0.95);
    const vec3 CONE_COLOR   = vec3(0.95, 0.65, 0.15);

    // Sample procedural voxel grid at world position and LOD
    vec4 sampleVoxelScene(vec3 pos, float lod) {
      float cellSize = (ROOM_MAX.x - ROOM_MIN.x) / uVoxelResolution;
      float filterWidth = cellSize * pow(2.0, max(lod, 0.0));

      if (pos.x < ROOM_MIN.x || pos.x > ROOM_MAX.x ||
          pos.y < ROOM_MIN.y || pos.y > ROOM_MAX.y ||
          pos.z < ROOM_MIN.z || pos.z > ROOM_MAX.z) {
        return vec4(0.0);
      }

      // 1. Red Left Wall
      if (abs(pos.x - ROOM_MIN.x) < filterWidth * 1.2) {
        float directLight = max(dot(vec3(1.0, 0.0, 0.0), normalize(uLightPos - pos)), 0.0) * 0.8 + 0.2;
        return vec4(RED_WALL * directLight * uLightColor, 1.0);
      }

      // 2. Green Right Wall
      if (abs(pos.x - ROOM_MAX.x) < filterWidth * 1.2) {
        float directLight = max(dot(vec3(-1.0, 0.0, 0.0), normalize(uLightPos - pos)), 0.0) * 0.8 + 0.2;
        return vec4(GREEN_WALL * directLight * uLightColor, 1.0);
      }

      // 3. White Back Wall
      if (abs(pos.z - ROOM_MIN.z) < filterWidth * 1.2) {
        float directLight = max(dot(vec3(0.0, 0.0, 1.0), normalize(uLightPos - pos)), 0.0) * 0.8 + 0.2;
        return vec4(WHITE_WALL * directLight * uLightColor, 1.0);
      }

      // 4. Floor
      if (abs(pos.y - ROOM_MIN.y) < filterWidth * 1.2) {
        float directLight = max(dot(vec3(0.0, 1.0, 0.0), normalize(uLightPos - pos)), 0.0) * 0.8 + 0.2;
        return vec4(FLOOR_COL * directLight * uLightColor, 1.0);
      }

      // 5. Ceiling
      if (abs(pos.y - ROOM_MAX.y) < filterWidth * 1.2) {
        return vec4(WHITE_WALL * 0.4, 1.0);
      }

      // 6. Model: Sphere at (1.1, -0.65, 0.3), radius 0.55
      vec3 spherePos = vec3(1.1, -0.65, 0.3);
      float dSphere = length(pos - spherePos) - 0.55;
      if (dSphere < filterWidth * 0.8) {
        float direct = max(dot(normalize(pos - spherePos), normalize(uLightPos - pos)), 0.0) * 0.8 + 0.2;
        return vec4(SPHERE_COLOR * direct * uLightColor, 1.0);
      }

      // 7. Model: Cube at (-1.1, -0.65, -0.4), half-size 0.55
      vec3 cubePos = vec3(-1.1, -0.65, -0.4);
      vec3 dCube = abs(pos - cubePos) - vec3(0.55);
      float dCubeDist = max(max(dCube.x, dCube.y), dCube.z);
      if (dCubeDist < filterWidth * 0.8) {
        float direct = max(dot(vec3(0.0, 1.0, 0.0), normalize(uLightPos - pos)), 0.0) * 0.8 + 0.2;
        return vec4(CUBE_COLOR * direct * uLightColor, 1.0);
      }

      // 8. Model: Cone at (0.0, -1.2, 0.8), height 1.2, radius 0.5
      vec3 coneBase = vec3(0.0, -1.2, 0.8);
      vec3 coneRel = pos - coneBase;
      if (coneRel.y >= 0.0 && coneRel.y <= 1.2) {
        float expectedRadius = 0.5 * (1.0 - coneRel.y / 1.2);
        float rDist = length(coneRel.xz) - expectedRadius;
        if (rDist < filterWidth * 0.8) {
          float direct = max(dot(vec3(0.0, 0.7, 0.7), normalize(uLightPos - pos)), 0.0) * 0.8 + 0.2;
          return vec4(CONE_COLOR * direct * uLightColor, 1.0);
        }
      }

      return vec4(0.0);
    }

    // Cone Tracing function
    vec4 traceCone(vec3 origin, vec3 dir, float tanHalfAngle, float maxDist) {
      vec4 accum = vec4(0.0);
      float cellSize = (ROOM_MAX.x - ROOM_MIN.x) / uVoxelResolution;
      float dist = cellSize * 1.5;

      for (int i = 0; i < 28; i++) {
        if (dist >= maxDist || accum.a >= 0.95) break;

        float diameter = 2.0 * dist * tanHalfAngle;
        float lod = log2(max(diameter / cellSize, 1.0));
        vec3 samplePos = origin + dir * dist;

        vec4 voxel = sampleVoxelScene(samplePos, lod);
        if (voxel.a > 0.01) {
          float weight = (1.0 - accum.a) * voxel.a;
          accum.rgb += weight * voxel.rgb;
          accum.a += weight;
        }

        dist += max(diameter * 0.5 * uStepSize, cellSize * 0.5);
      }

      return accum;
    }

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

      // Tangent frame for diffuse cones
      vec3 T, B;
      createBasis(N, T, B);

      // Diffuse Indirect Cone Tracing (GI)
      vec3 indirectDiffuse = vec3(0.0);
      float totalWeight = 0.0;
      float totalOcclusion = 0.0;
      float tanAperture = max(uConeAperture, 0.1);

      // Cone 1: along surface normal
      vec4 coneRes0 = traceCone(vWorldPos, N, tanAperture, 6.0);
      indirectDiffuse += coneRes0.rgb * 0.35;
      totalOcclusion += coneRes0.a * 0.35;
      totalWeight += 0.35;

      // 4 Tilted Hemispherical Cones
      if (uConeCount >= 5) {
        float angleStep = 6.2831853 / 4.0;
        float elevation = 0.785398; // 45 deg
        float cosEle = cos(elevation);
        float sinEle = sin(elevation);

        for (int i = 0; i < 4; i++) {
          float phi = float(i) * angleStep;
          vec3 coneDir = normalize(N * sinEle + (T * cos(phi) + B * sin(phi)) * cosEle);
          vec4 cRes = traceCone(vWorldPos, coneDir, tanAperture, 5.0);
          indirectDiffuse += cRes.rgb * 0.15;
          totalOcclusion += cRes.a * 0.15;
          totalWeight += 0.15;
        }
      }

      // Additional Ring (if 9 cones)
      if (uConeCount >= 9) {
        float angleStep = 6.2831853 / 4.0;
        float elevation = 0.4;
        float cosEle = cos(elevation);
        float sinEle = sin(elevation);

        for (int i = 0; i < 4; i++) {
          float phi = float(i) * angleStep + 0.785;
          vec3 coneDir = normalize(N * sinEle + (T * cos(phi) + B * sin(phi)) * cosEle);
          vec4 cRes = traceCone(vWorldPos, coneDir, tanAperture * 1.2, 4.5);
          indirectDiffuse += cRes.rgb * 0.1;
          totalOcclusion += cRes.a * 0.1;
          totalWeight += 0.1;
        }
      }

      indirectDiffuse = (indirectDiffuse / totalWeight) * uGiBoost * uDiffuseColor;
      float ao = clamp(1.0 - (totalOcclusion / totalWeight) * uAoFactor, 0.0, 1.0);

      // Specular Reflection Cone Tracing
      float specTanAperture = max(uSpecularRoughness * 0.7, 0.02);
      vec4 specConeRes = traceCone(vWorldPos, R, specTanAperture, 6.0);
      vec3 indirectSpecular = specConeRes.rgb * uSpecularColor * (1.0 - uSpecularRoughness);

      // Direct Specular
      vec3 H = normalize(L + V);
      float directSpecFactor = pow(max(dot(N, H), 0.0), mix(128.0, 8.0, uSpecularRoughness));
      vec3 directSpecular = uSpecularColor * uLightColor * directSpecFactor * uLightIntensity * attenuation;

      vec3 ambient = uAmbientColor * uDiffuseColor * ao;
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
