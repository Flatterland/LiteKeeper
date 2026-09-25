import * as THREE from 'three';

export const RayTracingShader = {
  uniforms: {
    uResolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) },
    uCameraPos: { value: new THREE.Vector3(0, 1.2, 4.5) },
    uCameraTarget: { value: new THREE.Vector3(0, 0.5, 0) },
    uInvProjection: { value: new THREE.Matrix4() },
    uInvView: { value: new THREE.Matrix4() },
    uLightPos: { value: new THREE.Vector3(0.6, 2.5, 0.6) },
    uLightColor: { value: new THREE.Color(1.0, 0.96, 0.88) },
    uLightIntensity: { value: 2.2 },
    uLightRadius: { value: 0.22 }, // soft shadow radius
    uBounceCount: { value: 3 }, // 1 to 4 bounces
    uSamplesPerPixel: { value: 4 }, // taps: 1 to 16
    uRoughness: { value: 0.15 },
    uMaxDistance: { value: 20.0 },
    uDebugPass: { value: 0 }, // 0: Combined, 1: Direct+Shadows, 2: Bounce 1 GI, 3: Multi-bounce GI, 4: G-Buffer, 5: Heatmap, 6: Noise
    uTime: { value: 0.0 },
    uFrameCount: { value: 0 }
  },

  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = vec4(position, 1.0);
    }
  `,

  fragmentShader: /* glsl */ `
    precision highp float;

    uniform vec2 uResolution;
    uniform vec3 uCameraPos;
    uniform vec3 uCameraTarget;
    uniform mat4 uInvProjection;
    uniform mat4 uInvView;
    uniform vec3 uLightPos;
    uniform vec3 uLightColor;
    uniform float uLightIntensity;
    uniform float uLightRadius;
    uniform int uBounceCount;
    uniform int uSamplesPerPixel;
    uniform float uRoughness;
    uniform float uMaxDistance;
    uniform int uDebugPass;
    uniform float uTime;
    uniform int uFrameCount;

    varying vec2 vUv;

    // Cornell Box boundaries
    const vec3 ROOM_MIN = vec3(-2.5, -1.2, -2.5);
    const vec3 ROOM_MAX = vec3(2.5, 3.2, 2.5);

    // Unified Scene Colors
    const vec3 RED_WALL   = vec3(0.9, 0.15, 0.2);
    const vec3 GREEN_WALL = vec3(0.15, 0.85, 0.3);
    const vec3 WHITE_WALL = vec3(0.9, 0.9, 0.92);
    const vec3 FLOOR_COL  = vec3(0.7, 0.7, 0.72);

    const vec3 CUBE_COLOR   = vec3(0.88, 0.88, 0.9);
    const vec3 SPHERE_COLOR = vec3(0.2, 0.7, 0.95);
    const vec3 CONE_COLOR   = vec3(0.95, 0.65, 0.15);

    struct Hit {
      float t;
      vec3 p;
      vec3 normal;
      vec3 albedo;
      float metallic;
      float roughness;
      bool isLight;
    };

    // Hash helpers for random sampling
    float hash13(vec3 p3) {
      p3 = fract(p3 * 0.1031);
      p3 += dot(p3, p3.yzx + 33.33);
      return fract((p3.x + p3.y) * p3.z);
    }

    vec2 hash23(vec3 p3) {
      p3 = fract(p3 * vec3(0.1031, 0.1030, 0.0973));
      p3 += dot(p3, p3.yzx + 33.33);
      return fract((p3.xx + p3.yz) * p3.zy);
    }

    vec3 cosineSampleHemisphere(vec3 n, vec2 u) {
      float phi = 6.2831853 * u.x;
      float cosTheta = sqrt(u.y);
      float sinTheta = sqrt(1.0 - u.y);
      vec3 h = vec3(sinTheta * cos(phi), sinTheta * sin(phi), cosTheta);

      vec3 up = abs(n.z) < 0.999 ? vec3(0.0, 0.0, 1.0) : vec3(1.0, 0.0, 0.0);
      vec3 t = normalize(cross(up, n));
      vec3 b = cross(n, t);
      return t * h.x + b * h.y + n * h.z;
    }

    // 1. Ray-Sphere intersection
    bool intersectSphere(vec3 ro, vec3 rd, vec3 center, float radius, inout Hit hit, vec3 albedo, float metallic, float rough) {
      vec3 oc = ro - center;
      float b = dot(oc, rd);
      float c = dot(oc, oc) - radius * radius;
      float discr = b * b - c;
      if (discr > 0.0) {
        float temp = -b - sqrt(discr);
        if (temp > 0.001 && temp < hit.t) {
          hit.t = temp;
          hit.p = ro + rd * temp;
          hit.normal = normalize(hit.p - center);
          hit.albedo = albedo;
          hit.metallic = metallic;
          hit.roughness = rough;
          hit.isLight = false;
          return true;
        }
      }
      return false;
    }

    // 2. Ray-Box (Rotated Cube) intersection
    bool intersectOrientedBox(vec3 ro, vec3 rd, vec3 center, vec3 halfSize, float rotY, inout Hit hit, vec3 albedo, float metallic, float rough) {
      float cosA = cos(-rotY);
      float sinA = sin(-rotY);
      mat2 rotMat = mat2(cosA, -sinA, sinA, cosA);

      // Local ray origin and direction
      vec3 localRo = ro - center;
      localRo.xz = rotMat * localRo.xz;
      vec3 localRd = rd;
      localRd.xz = rotMat * localRd.xz;

      vec3 m = 1.0 / localRd;
      vec3 n = m * localRo;
      vec3 k = abs(m) * halfSize;
      vec3 t1 = -n - k;
      vec3 t2 = -n + k;

      float tN = max(max(t1.x, t1.y), t1.z);
      float tF = min(min(t2.x, t2.y), t2.z);

      if (tN > tF || tF < 0.001) return false;

      float tHit = tN > 0.001 ? tN : tF;
      if (tHit > 0.001 && tHit < hit.t) {
        hit.t = tHit;
        hit.p = ro + rd * tHit;

        // Compute local normal
        vec3 localP = localRo + localRd * tHit;
        vec3 d = abs(localP) - halfSize;
        vec3 localNorm = vec3(0.0);
        if (d.x > d.y && d.x > d.z) localNorm = vec3(sign(localP.x), 0.0, 0.0);
        else if (d.y > d.z) localNorm = vec3(0.0, sign(localP.y), 0.0);
        else localNorm = vec3(0.0, 0.0, sign(localP.z));

        // Rotate normal back to world
        float cosB = cos(rotY);
        float sinB = sin(rotY);
        mat2 unrot = mat2(cosB, -sinB, sinB, cosB);
        vec3 worldNorm = localNorm;
        worldNorm.xz = unrot * worldNorm.xz;

        hit.normal = normalize(worldNorm);
        hit.albedo = albedo;
        hit.metallic = metallic;
        hit.roughness = rough;
        hit.isLight = false;
        return true;
      }
      return false;
    }

    // 3. Ray-Cone intersection (Analytical)
    // Base center at baseCenter, height H, radius R, pointing +Y
    bool intersectCone(vec3 ro, vec3 rd, vec3 baseCenter, float H, float R, inout Hit hit, vec3 albedo, float metallic, float rough) {
      vec3 tip = baseCenter + vec3(0.0, H, 0.0);
      float k = R / H;
      float k2 = k * k;

      vec3 co = ro - tip;
      float a = rd.x * rd.x + rd.z * rd.z - k2 * rd.y * rd.y;
      float b = 2.0 * (co.x * rd.x + co.z * rd.z - k2 * co.y * rd.y);
      float c = co.x * co.x + co.z * co.z - k2 * co.y * co.y;

      float discr = b * b - 4.0 * a * c;
      bool found = false;

      if (discr >= 0.0) {
        float sqrtD = sqrt(discr);
        float t0 = (-b - sqrtD) / (2.0 * a);
        float t1 = (-b + sqrtD) / (2.0 * a);

        float tSide = 1e9;
        if (t0 > 0.001) {
          float y = (ro + rd * t0).y;
          if (y >= baseCenter.y && y <= tip.y) tSide = t0;
        }
        if (tSide > 1e8 && t1 > 0.001) {
          float y = (ro + rd * t1).y;
          if (y >= baseCenter.y && y <= tip.y) tSide = t1;
        }

        if (tSide < hit.t) {
          hit.t = tSide;
          hit.p = ro + rd * tSide;
          vec3 d = hit.p - tip;
          float rProj = length(d.xz);
          hit.normal = normalize(vec3(d.x, rProj * k, d.z));
          hit.albedo = albedo;
          hit.metallic = metallic;
          hit.roughness = rough;
          hit.isLight = false;
          found = true;
        }
      }

      // Base cap intersection (plane at y = baseCenter.y)
      if (abs(rd.y) > 0.0001) {
        float tCap = (baseCenter.y - ro.y) / rd.y;
        if (tCap > 0.001 && tCap < hit.t) {
          vec3 pCap = ro + rd * tCap;
          if (length(pCap.xz - baseCenter.xz) <= R) {
            hit.t = tCap;
            hit.p = pCap;
            hit.normal = vec3(0.0, -1.0, 0.0);
            hit.albedo = albedo;
            hit.metallic = metallic;
            hit.roughness = rough;
            hit.isLight = false;
            found = true;
          }
        }
      }

      return found;
    }

    // Unified Scene Intersection
    Hit intersectScene(vec3 ro, vec3 rd) {
      Hit hit;
      hit.t = uMaxDistance;
      hit.isLight = false;

      // 1. Light bulb sphere
      if (intersectSphere(ro, rd, uLightPos, uLightRadius, hit, uLightColor * uLightIntensity, 0.0, 1.0)) {
        hit.isLight = true;
      }

      // 2. Unified Model: Sphere at (1.1, -0.65, 0.3), radius 0.55
      intersectSphere(ro, rd, vec3(1.1, -0.65, 0.3), 0.55, hit, SPHERE_COLOR, 0.3, uRoughness);

      // 3. Unified Model: Cube at (-1.1, -0.6, -0.4), size 1.1, rot 20 deg
      intersectOrientedBox(ro, rd, vec3(-1.1, -0.65, -0.4), vec3(0.55), 0.35, hit, CUBE_COLOR, 0.0, uRoughness);

      // 4. Unified Model: Cone at (0.0, -1.2, 0.8), height 1.2, radius 0.5
      intersectCone(ro, rd, vec3(0.0, -1.2, 0.8), 1.2, 0.5, hit, CONE_COLOR, 0.1, uRoughness);

      // 5. Cornell Box Planes
      // Left Wall (x = ROOM_MIN.x = -2.5, normal = (1, 0, 0))
      if (rd.x < -0.0001) {
        float t = (ROOM_MIN.x - ro.x) / rd.x;
        if (t > 0.001 && t < hit.t) {
          vec3 p = ro + rd * t;
          if (p.y >= ROOM_MIN.y && p.y <= ROOM_MAX.y && p.z >= ROOM_MIN.z && p.z <= ROOM_MAX.z) {
            hit.t = t; hit.p = p; hit.normal = vec3(1.0, 0.0, 0.0);
            hit.albedo = RED_WALL; hit.metallic = 0.0; hit.roughness = 0.9;
            hit.isLight = false;
          }
        }
      }

      // Right Wall (x = ROOM_MAX.x = 2.5, normal = (-1, 0, 0))
      if (rd.x > 0.0001) {
        float t = (ROOM_MAX.x - ro.x) / rd.x;
        if (t > 0.001 && t < hit.t) {
          vec3 p = ro + rd * t;
          if (p.y >= ROOM_MIN.y && p.y <= ROOM_MAX.y && p.z >= ROOM_MIN.z && p.z <= ROOM_MAX.z) {
            hit.t = t; hit.p = p; hit.normal = vec3(-1.0, 0.0, 0.0);
            hit.albedo = GREEN_WALL; hit.metallic = 0.0; hit.roughness = 0.9;
            hit.isLight = false;
          }
        }
      }

      // Back Wall (z = ROOM_MIN.z = -2.5, normal = (0, 0, 1))
      if (rd.z < -0.0001) {
        float t = (ROOM_MIN.z - ro.z) / rd.z;
        if (t > 0.001 && t < hit.t) {
          vec3 p = ro + rd * t;
          if (p.x >= ROOM_MIN.x && p.x <= ROOM_MAX.x && p.y >= ROOM_MIN.y && p.y <= ROOM_MAX.y) {
            hit.t = t; hit.p = p; hit.normal = vec3(0.0, 0.0, 1.0);
            hit.albedo = WHITE_WALL; hit.metallic = 0.0; hit.roughness = 0.9;
            hit.isLight = false;
          }
        }
      }

      // Floor (y = ROOM_MIN.y = -1.2, normal = (0, 1, 0))
      if (rd.y < -0.0001) {
        float t = (ROOM_MIN.y - ro.y) / rd.y;
        if (t > 0.001 && t < hit.t) {
          vec3 p = ro + rd * t;
          if (p.x >= ROOM_MIN.x && p.x <= ROOM_MAX.x && p.z >= ROOM_MIN.z && p.z <= ROOM_MAX.z) {
            hit.t = t; hit.p = p; hit.normal = vec3(0.0, 1.0, 0.0);
            float check = mod(floor(p.x * 2.0) + floor(p.z * 2.0), 2.0);
            hit.albedo = mix(FLOOR_COL, FLOOR_COL * 0.75, check);
            hit.metallic = 0.05; hit.roughness = 0.6;
            hit.isLight = false;
          }
        }
      }

      // Ceiling (y = ROOM_MAX.y = 3.2, normal = (0, -1, 0))
      if (rd.y > 0.0001) {
        float t = (ROOM_MAX.y - ro.y) / rd.y;
        if (t > 0.001 && t < hit.t) {
          vec3 p = ro + rd * t;
          if (p.x >= ROOM_MIN.x && p.x <= ROOM_MAX.x && p.z >= ROOM_MIN.z && p.z <= ROOM_MAX.z) {
            hit.t = t; hit.p = p; hit.normal = vec3(0.0, -1.0, 0.0);
            hit.albedo = WHITE_WALL; hit.metallic = 0.0; hit.roughness = 0.95;
            hit.isLight = false;
          }
        }
      }

      return hit;
    }

    // Shadow ray test
    float evaluateShadow(vec3 p, vec3 lightTarget, vec3 n, vec3 seed) {
      vec3 lightDir = lightTarget - p;
      float distToLight = length(lightDir);
      vec3 rd = normalize(lightDir);
      vec3 ro = p + n * 0.005;

      Hit hit = intersectScene(ro, rd);
      if (!hit.isLight && hit.t < distToLight - 0.05) {
        return 0.0; // Occluded
      }
      return 1.0;
    }

    vec3 costHeatmap(float steps) {
      float t = clamp(steps / 12.0, 0.0, 1.0);
      return vec3(smoothstep(0.4, 0.8, t), 1.0 - abs(t - 0.5) * 2.0, 1.0 - smoothstep(0.1, 0.5, t));
    }

    void main() {
      vec2 ndc = (vUv * 2.0 - 1.0);
      vec4 target = uInvProjection * vec4(ndc.x, ndc.y, 1.0, 1.0);
      vec3 rayDirView = target.xyz / target.w;
      vec3 primaryRayDir = normalize((uInvView * vec4(rayDirView, 0.0)).xyz);
      vec3 primaryRayOrigin = uCameraPos;

      vec3 accumulatedColor = vec3(0.0);
      vec3 firstHitNormal = vec3(0.0);
      float totalRaysTraced = 0.0;

      vec3 directOnly = vec3(0.0);
      vec3 bounce1Only = vec3(0.0);
      vec3 multiBounceOnly = vec3(0.0);

      int numSamples = clamp(uSamplesPerPixel, 1, 16);

      for (int s = 0; s < 16; s++) {
        if (s >= numSamples) break;

        vec3 sampleSeed = vec3(vUv, float(s) + uTime * 10.0 + float(uFrameCount));
        vec2 jitter = (hash23(sampleSeed) - 0.5) / uResolution;

        vec4 jTarget = uInvProjection * vec4(ndc.x + jitter.x * 2.0, ndc.y + jitter.y * 2.0, 1.0, 1.0);
        vec3 curDir = normalize((uInvView * vec4(jTarget.xyz / jTarget.w, 0.0)).xyz);
        vec3 curOrigin = primaryRayOrigin;

        vec3 throughput = vec3(1.0);
        vec3 pathRadiance = vec3(0.0);

        for (int bounce = 0; bounce < 5; bounce++) {
          if (bounce > uBounceCount) break;

          totalRaysTraced += 1.0;
          Hit hit = intersectScene(curOrigin, curDir);

          if (hit.t >= uMaxDistance) {
            pathRadiance += throughput * vec3(0.03, 0.04, 0.06);
            break;
          }

          if (hit.isLight) {
            pathRadiance += throughput * hit.albedo;
            break;
          }

          if (bounce == 0 && s == 0) {
            firstHitNormal = hit.normal;
          }

          // Direct Lighting from light bulb with soft shadow penumbra
          vec2 lightJitter = hash23(sampleSeed + float(bounce) * 17.3) - 0.5;
          vec3 jitteredLight = uLightPos + vec3(lightJitter.x, 0.0, lightJitter.y) * uLightRadius * 1.5;

          vec3 toLight = jitteredLight - hit.p;
          float distL = length(toLight);
          vec3 L = normalize(toLight);

          float NdotL = max(dot(hit.normal, L), 0.0);
          float shadow = evaluateShadow(hit.p, jitteredLight, hit.normal, sampleSeed);
          totalRaysTraced += 1.0;

          float attenuation = 1.0 / (1.0 + 0.08 * distL + 0.03 * distL * distL);
          vec3 directLi = hit.albedo * uLightColor * (NdotL * shadow * uLightIntensity * attenuation);

          // Specular highlight direct
          vec3 V = -curDir;
          vec3 H = normalize(L + V);
          float specFactor = pow(max(dot(hit.normal, H), 0.0), mix(256.0, 4.0, hit.roughness));
          directLi += vec3(specFactor * shadow * attenuation * uLightIntensity * (1.0 - hit.roughness));

          pathRadiance += throughput * directLi;

          if (bounce == 0) {
            directOnly += directLi;
          }

          // Next bounce ray (diffuse cosine or specular reflection)
          vec2 xi = hash23(sampleSeed + vec3(float(bounce) * 31.7, float(s) * 11.2, 5.0));
          bool isSpecular = hash13(sampleSeed + vec3(float(bounce), 4.1, 9.2)) < (1.0 - hit.roughness);
          vec3 nextDir;

          if (isSpecular) {
            vec3 refl = reflect(curDir, hit.normal);
            vec3 randCone = cosineSampleHemisphere(refl, xi);
            nextDir = normalize(mix(refl, randCone, hit.roughness * 0.4));
            throughput *= mix(hit.albedo, vec3(1.0), hit.metallic);
          } else {
            nextDir = cosineSampleHemisphere(hit.normal, xi);
            throughput *= hit.albedo;
          }

          curOrigin = hit.p + hit.normal * 0.005;
          curDir = nextDir;

          if (bounce == 1) {
            bounce1Only += pathRadiance - directOnly;
          } else if (bounce >= 2) {
            multiBounceOnly += pathRadiance - directOnly - bounce1Only;
          }

          // Russian roulette termination for deep bounces
          if (bounce > 2) {
            float pSurvive = clamp(max(throughput.r, max(throughput.g, throughput.b)), 0.1, 0.9);
            if (hash13(sampleSeed + vec3(float(bounce), 7.7, 1.3)) > pSurvive) break;
            throughput /= pSurvive;
          }
        }

        accumulatedColor += pathRadiance;
      }

      accumulatedColor /= float(numSamples);
      directOnly /= float(numSamples);
      bounce1Only /= float(numSamples);
      multiBounceOnly /= float(numSamples);

      vec3 finalRgb = accumulatedColor / (accumulatedColor + vec3(1.0));
      finalRgb = pow(finalRgb, vec3(1.0 / 2.2));

      // Debug pass handling
      if (uDebugPass == 1) {
        // Direct Illumination + Soft Shadows
        vec3 dRgb = directOnly / (directOnly + vec3(1.0));
        gl_FragColor = vec4(pow(dRgb, vec3(1.0 / 2.2)), 1.0);
      } else if (uDebugPass == 2) {
        // Bounce 1 Indirect GI Only
        vec3 b1Rgb = bounce1Only * 2.5;
        gl_FragColor = vec4(pow(b1Rgb / (b1Rgb + vec3(1.0)), vec3(1.0 / 2.2)), 1.0);
      } else if (uDebugPass == 3) {
        // Multi-Bounce (2+) Indirect
        vec3 mbRgb = multiBounceOnly * 3.5;
        gl_FragColor = vec4(pow(mbRgb / (mbRgb + vec3(1.0)), vec3(1.0 / 2.2)), 1.0);
      } else if (uDebugPass == 4) {
        // G-Buffer (World Normals)
        gl_FragColor = vec4(firstHitNormal * 0.5 + 0.5, 1.0);
      } else if (uDebugPass == 5) {
        // Ray Traversal Heatmap (cost)
        float avgSteps = totalRaysTraced / float(numSamples);
        gl_FragColor = vec4(costHeatmap(avgSteps), 1.0);
      } else if (uDebugPass == 6) {
        // Noise / Variance pass
        float variance = abs(accumulatedColor.r - accumulatedColor.g);
        gl_FragColor = vec4(vec3(variance * 4.0), 1.0);
      } else {
        // Final Combined
        gl_FragColor = vec4(finalRgb, 1.0);
      }
    }
  `
};

export function createRayTracingMaterial(customUniforms = {}) {
  const uniforms = THREE.UniformsUtils.clone(RayTracingShader.uniforms);
  for (const key in customUniforms) {
    if (uniforms[key]) {
      uniforms[key].value = customUniforms[key];
    }
  }

  return new THREE.ShaderMaterial({
    uniforms: uniforms,
    vertexShader: RayTracingShader.vertexShader,
    fragmentShader: RayTracingShader.fragmentShader,
    depthWrite: false,
    depthTest: false
  });
}
