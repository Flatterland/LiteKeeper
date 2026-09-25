import * as THREE from 'three';

export const GouraudShader = {
  uniforms: {
    uLightPos: { value: new THREE.Vector3(2, 3, 2) },
    uLightColor: { value: new THREE.Color(1.0, 0.95, 0.85) },
    uLightIntensity: { value: 1.5 },
    uAmbientColor: { value: new THREE.Color(0.1, 0.12, 0.18) },
    uAmbientIntensity: { value: 0.3 },
    uDiffuseColor: { value: new THREE.Color(0.2, 0.6, 0.9) },
    uSpecularColor: { value: new THREE.Color(1.0, 1.0, 1.0) },
    uShininess: { value: 32.0 },
    uSpecularIntensity: { value: 1.0 },
    uDebugPass: { value: 0 }, // 0: Combined, 1: Vertex Normals, 2: Raw Vertex Colors, 3: Tessellation, 4: Specular Loss Map
    uCameraPos: { value: new THREE.Vector3(0, 0, 5) }
  },

  vertexShader: /* glsl */ `
    uniform vec3 uLightPos;
    uniform vec3 uLightColor;
    uniform float uLightIntensity;
    uniform vec3 uAmbientColor;
    uniform float uAmbientIntensity;
    uniform vec3 uDiffuseColor;
    uniform vec3 uSpecularColor;
    uniform float uShininess;
    uniform float uSpecularIntensity;
    uniform vec3 uCameraPos;

    varying vec3 vGouraudColor;
    varying vec3 vNormal;
    varying vec3 vWorldPos;
    varying vec3 vSpecularOnly;
    varying vec3 vDiffuseOnly;

    void main() {
      vec4 worldPosition = modelMatrix * vec4(position, 1.0);
      vWorldPos = worldPosition.xyz;

      // Transform vertex normal to world space
      vec3 N = normalize(mat3(modelMatrix) * normal);
      vNormal = N;

      vec3 L = normalize(uLightPos - vWorldPos);
      vec3 V = normalize(uCameraPos - vWorldPos);
      vec3 R = reflect(-L, N);

      float dist = length(uLightPos - vWorldPos);
      float attenuation = 1.0 / (1.0 + 0.09 * dist + 0.032 * dist * dist);

      // Gouraud evaluates lighting STRICTLY at the vertex!
      float NdotL = max(dot(N, L), 0.0);
      vec3 diffuse = uDiffuseColor * uLightColor * NdotL * uLightIntensity * attenuation;
      vDiffuseOnly = diffuse;

      // Specular at vertex
      float RdotV = max(dot(R, V), 0.0);
      float spec = pow(RdotV, uShininess);
      vec3 specular = uSpecularColor * uLightColor * spec * uSpecularIntensity * attenuation;
      vSpecularOnly = specular;

      // Ambient
      vec3 ambient = uAmbientColor * uAmbientIntensity * uDiffuseColor;

      // Combined vertex color to be linearly interpolated by rasterizer
      vGouraudColor = ambient + diffuse + specular;

      gl_Position = projectionMatrix * viewMatrix * worldPosition;
    }
  `,

  fragmentShader: /* glsl */ `
    precision highp float;

    uniform int uDebugPass;
    uniform vec3 uLightPos;
    uniform vec3 uCameraPos;
    uniform float uShininess;

    varying vec3 vGouraudColor;
    varying vec3 vNormal;
    varying vec3 vWorldPos;
    varying vec3 vSpecularOnly;
    varying vec3 vDiffuseOnly;

    void main() {
      if (uDebugPass == 1) {
        // Vertex Normals interpolated across face [0, 1]
        gl_FragColor = vec4(normalize(vNormal) * 0.5 + 0.5, 1.0);
      } else if (uDebugPass == 2) {
        // Raw Vertex Colors pass
        gl_FragColor = vec4(vGouraudColor, 1.0);
      } else if (uDebugPass == 3) {
        // Tessellation wireframe showing triangle edge derivatives
        vec3 dX = abs(dFdx(vNormal));
        vec3 dY = abs(dFdy(vNormal));
        float edge = length(dX + dY) * 20.0;
        vec3 edgeColor = mix(vGouraudColor * 0.3, vec3(0.2, 1.0, 0.5), clamp(edge, 0.0, 1.0));
        gl_FragColor = vec4(edgeColor, 1.0);
      } else if (uDebugPass == 4) {
        // Specular highlight clipping artifact:
        // Compare interpolated specular against true per-pixel specular to highlight Gouraud's flaw!
        vec3 trueN = normalize(vNormal);
        vec3 trueL = normalize(uLightPos - vWorldPos);
        vec3 trueV = normalize(uCameraPos - vWorldPos);
        vec3 trueR = reflect(-trueL, trueN);
        float trueSpec = pow(max(dot(trueR, trueV), 0.0), uShininess);
        float gouraudSpec = length(vSpecularOnly);
        float discrepancy = abs(trueSpec - gouraudSpec);

        // Highlight missing/clipped specular peak in red/yellow
        vec3 errorMap = mix(vec3(0.05, 0.05, 0.1), vec3(1.0, 0.2, 0.1), clamp(discrepancy * 2.0, 0.0, 1.0));
        gl_FragColor = vec4(errorMap, 1.0);
      } else {
        // Final Combined: pure interpolated vertex color
        gl_FragColor = vec4(vGouraudColor, 1.0);
      }
    }
  `
};

export function createGouraudMaterial(customUniforms = {}) {
  const uniforms = THREE.UniformsUtils.clone(GouraudShader.uniforms);
  for (const key in customUniforms) {
    if (uniforms[key]) {
      uniforms[key].value = customUniforms[key];
    }
  }

  return new THREE.ShaderMaterial({
    uniforms: uniforms,
    vertexShader: GouraudShader.vertexShader,
    fragmentShader: GouraudShader.fragmentShader,
    side: THREE.DoubleSide
  });
}
