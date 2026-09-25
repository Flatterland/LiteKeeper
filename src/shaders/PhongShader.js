import * as THREE from 'three';

export const PhongShader = {
  uniforms: {
    uLightPos: { value: new THREE.Vector3(2, 3, 2) },
    uLightColor: { value: new THREE.Color(1.0, 0.95, 0.85) },
    uLightIntensity: { value: 1.5 },
    uAmbientColor: { value: new THREE.Color(0.1, 0.12, 0.18) },
    uAmbientIntensity: { value: 0.3 },
    uDiffuseColor: { value: new THREE.Color(0.2, 0.6, 0.9) },
    uSpecularColor: { value: new THREE.Color(1.0, 1.0, 1.0) },
    uShininess: { value: 64.0 },
    uSpecularIntensity: { value: 1.2 },
    uDiffuseIntensity: { value: 1.0 },
    uLightDecay: { value: 0.5 },
    uIsBlinn: { value: 1 }, // 1: Blinn-Phong, 0: Classic Phong
    uDebugPass: { value: 0 }, // 0: Combined, 1: World Normals, 2: Diffuse, 3: Specular, 4: Ambient, 5: N.L Heatmap
    uCameraPos: { value: new THREE.Vector3(0, 0, 5) }
  },

  vertexShader: /* glsl */ `
    varying vec3 vNormal;
    varying vec3 vWorldPos;

    void main() {
      vec4 worldPosition = modelMatrix * vec4(position, 1.0);
      vWorldPos = worldPosition.xyz;
      // Normal matrix transforms normal to world space
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
    uniform float uAmbientIntensity;
    uniform vec3 uDiffuseColor;
    uniform vec3 uSpecularColor;
    uniform float uShininess;
    uniform float uSpecularIntensity;
    uniform float uDiffuseIntensity;
    uniform float uLightDecay;
    uniform int uIsBlinn;
    uniform int uDebugPass;
    uniform vec3 uCameraPos;

    varying vec3 vNormal;
    varying vec3 vWorldPos;

    vec3 heatmap(float t) {
      return clamp(vec3(
        smoothstep(0.5, 0.8, t),
        1.0 - abs(t - 0.5) * 2.0,
        1.0 - smoothstep(0.2, 0.5, t)
      ), 0.0, 1.0);
    }

    void main() {
      // Re-normalize normal per fragment (crucial difference from Gouraud)
      vec3 N = normalize(vNormal);
      if (!gl_FrontFacing) N = -N;

      vec3 L = normalize(uLightPos - vWorldPos);
      vec3 V = normalize(uCameraPos - vWorldPos);
      vec3 R = reflect(-L, N);
      vec3 H = normalize(L + V);

      float dist = length(uLightPos - vWorldPos);
      float attenuation = 1.0 / (1.0 + (0.05 + 0.1 * uLightDecay) * dist + (0.02 + 0.05 * uLightDecay) * dist * dist);

      // Diffuse (Lambertian)
      float NdotL = max(dot(N, L), 0.0);
      vec3 diffuse = uDiffuseColor * uLightColor * NdotL * uDiffuseIntensity * uLightIntensity * attenuation;

      // Specular
      float specTerm = 0.0;
      if (NdotL > 0.0) {
        if (uIsBlinn == 1) {
          // Blinn-Phong: uses halfway vector H
          float NdotH = max(dot(N, H), 0.0);
          specTerm = pow(NdotH, uShininess * 4.0);
        } else {
          // Classic Phong: uses reflection vector R
          float RdotV = max(dot(R, V), 0.0);
          specTerm = pow(RdotV, uShininess);
        }
      }
      vec3 specular = uSpecularColor * uLightColor * specTerm * uSpecularIntensity * uLightIntensity * attenuation;

      // Ambient
      vec3 ambient = uAmbientColor * uAmbientIntensity * uDiffuseColor;

      vec3 combined = ambient + diffuse + specular;

      // Debug pass handling
      if (uDebugPass == 1) {
        // World Normals
        gl_FragColor = vec4(N * 0.5 + 0.5, 1.0);
      } else if (uDebugPass == 2) {
        // Pure Diffuse
        gl_FragColor = vec4(diffuse, 1.0);
      } else if (uDebugPass == 3) {
        // Pure Specular
        gl_FragColor = vec4(specular, 1.0);
      } else if (uDebugPass == 4) {
        // Ambient Pass
        gl_FragColor = vec4(ambient, 1.0);
      } else if (uDebugPass == 5) {
        // N.L Dot Product Heatmap
        gl_FragColor = vec4(heatmap(NdotL), 1.0);
      } else {
        // Final Combined
        gl_FragColor = vec4(combined, 1.0);
      }
    }
  `
};

export function createPhongMaterial(customUniforms = {}) {
  const uniforms = THREE.UniformsUtils.clone(PhongShader.uniforms);
  for (const key in customUniforms) {
    if (uniforms[key]) {
      uniforms[key].value = customUniforms[key];
    }
  }

  return new THREE.ShaderMaterial({
    uniforms: uniforms,
    vertexShader: PhongShader.vertexShader,
    fragmentShader: PhongShader.fragmentShader,
    side: THREE.DoubleSide
  });
}
