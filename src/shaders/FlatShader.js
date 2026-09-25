import * as THREE from 'three';

export const FlatShader = {
  uniforms: {
    uLightPos: { value: new THREE.Vector3(2, 3, 2) },
    uLightColor: { value: new THREE.Color(1.0, 0.95, 0.85) },
    uLightIntensity: { value: 1.5 },
    uAmbientColor: { value: new THREE.Color(0.1, 0.12, 0.18) },
    uAmbientIntensity: { value: 0.3 },
    uDiffuseColor: { value: new THREE.Color(0.2, 0.6, 0.9) },
    uSpecularColor: { value: new THREE.Color(1.0, 1.0, 1.0) },
    uRoughness: { value: 0.5 },
    uDebugPass: { value: 0 }, // 0: Combined, 1: Face Normals, 2: Wireframe/Facets, 3: Diffuse Only, 4: Incident Angle Heatmap
    uCameraPos: { value: new THREE.Vector3(0, 0, 5) }
  },

  vertexShader: /* glsl */ `
    varying vec3 vWorldPos;
    varying vec3 vBarycentric;

    attribute vec3 barycentric;

    void main() {
      vWorldPos = (modelMatrix * vec4(position, 1.0)).xyz;
      #ifdef USE_BARYCENTRIC
        vBarycentric = barycentric;
      #else
        vBarycentric = vec3(0.0);
      #endif
      gl_Position = projectionMatrix * viewMatrix * vec4(vWorldPos, 1.0);
    }
  `,

  fragmentShader: /* glsl */ `
    precision highp float;

    uniform vec3 uLightPos;
    uniform vec3 uLightColor;
    uniform float uLightIntensity;
    uniform vec3 uAmbientColor;
    uniform float uAmbientIntensity;
    uniform vec3 uDiffuseColor;
    uniform vec3 uSpecularColor;
    uniform float uRoughness;
    uniform int uDebugPass;
    uniform vec3 uCameraPos;

    varying vec3 vWorldPos;
    varying vec3 vBarycentric;

    // Helper to calculate face normal using screen space derivatives
    vec3 getFlatNormal(vec3 worldPos) {
      vec3 dX = dFdx(worldPos);
      vec3 dY = dFdy(worldPos);
      return normalize(cross(dX, dY));
    }

    // Heatmap color gradient from 0.0 (blue) to 1.0 (red)
    vec3 angleHeatmap(float t) {
      return clamp(vec3(
        smoothstep(0.5, 0.8, t),
        1.0 - abs(t - 0.5) * 2.0,
        1.0 - smoothstep(0.2, 0.5, t)
      ), 0.0, 1.0);
    }

    void main() {
      vec3 N = getFlatNormal(vWorldPos);
      // Ensure normal faces camera for double-sided/interior faces
      if (!gl_FrontFacing) N = -N;

      vec3 L = normalize(uLightPos - vWorldPos);
      vec3 V = normalize(uCameraPos - vWorldPos);
      vec3 R = reflect(-L, N);

      float NdotL = max(dot(N, L), 0.0);
      float dist = length(uLightPos - vWorldPos);
      float attenuation = 1.0 / (1.0 + 0.09 * dist + 0.032 * dist * dist);

      // Diffuse term
      vec3 diffuse = uDiffuseColor * uLightColor * NdotL * uLightIntensity * attenuation;
      // Ambient term
      vec3 ambient = uAmbientColor * uAmbientIntensity * uDiffuseColor;
      // Flat specular term (uniform across face)
      float specPower = mix(128.0, 4.0, uRoughness);
      float specFactor = pow(max(dot(R, V), 0.0), specPower);
      vec3 specular = uSpecularColor * uLightColor * specFactor * (1.0 - uRoughness) * attenuation;

      vec3 finalColor = ambient + diffuse + specular;

      // Debug pass handling
      if (uDebugPass == 1) {
        // Face Normals in RGB [0, 1]
        gl_FragColor = vec4(N * 0.5 + 0.5, 1.0);
      } else if (uDebugPass == 2) {
        // Facet wireframe / edges
        vec3 dX = abs(dFdx(N));
        vec3 dY = abs(dFdy(N));
        float edge = length(dX + dY) * 15.0;
        vec3 edgeColor = mix(finalColor * 0.4, vec3(0.1, 0.9, 1.0), clamp(edge, 0.0, 1.0));
        gl_FragColor = vec4(edgeColor, 1.0);
      } else if (uDebugPass == 3) {
        // Diffuse Only
        gl_FragColor = vec4(vec3(NdotL), 1.0);
      } else if (uDebugPass == 4) {
        // Incident Angle Heatmap (cos theta)
        gl_FragColor = vec4(angleHeatmap(NdotL), 1.0);
      } else {
        // Final Combined
        gl_FragColor = vec4(finalColor, 1.0);
      }
    }
  `
};

export function createFlatMaterial(customUniforms = {}) {
  const uniforms = THREE.UniformsUtils.clone(FlatShader.uniforms);
  for (const key in customUniforms) {
    if (uniforms[key]) {
      uniforms[key].value = customUniforms[key];
    }
  }

  return new THREE.ShaderMaterial({
    uniforms: uniforms,
    vertexShader: FlatShader.vertexShader,
    fragmentShader: FlatShader.fragmentShader,
    side: THREE.DoubleSide
  });
}
