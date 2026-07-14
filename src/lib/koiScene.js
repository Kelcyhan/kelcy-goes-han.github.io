import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone as cloneSkeleton } from 'three/examples/jsm/utils/SkeletonUtils.js';
import koiUrl from '../../assets/fish/koi.glb?url';

// “Koi Fish” by 7PLUS, licensed CC BY 4.0.
// https://sketchfab.com/3d-models/koi-fish-236859b809984f52b70c94fd040b9c59
const INITIAL_COUNT = 14;
const INITIAL_GROUPS = 5;
const FISH_MAX = 60;
const FLOCK_RADIUS = 3.2;
const FLOCK_MAX_NEIGHBORS = 3;
const SEPARATION_DIST = 0.9;
const ALIGN_W = 0.045;
const COHESION_W = 0.0018;
const SEPARATION_W = 0.05;
const MAX_TURN_RATE = 2.4;
const FADE_MS = 700;
const FIXED_STEP = 1 / 60;

const HUE_VARIANTS = [
  { hue: 0, sat: 1, brt: 1 },
  { hue: -8, sat: 1.25, brt: 0.93 },
  { hue: 15, sat: 1.1, brt: 1.02 },
  { hue: 30, sat: 1.15, brt: 1.05 },
  { hue: 50, sat: 1.2, brt: 1.1 },
  { hue: 0, sat: 0.55, brt: 1.08 },
];

let koiAssetPromise;

function loadKoiAsset() {
  if (!koiAssetPromise) {
    koiAssetPromise = new GLTFLoader().loadAsync(koiUrl);
  }
  return koiAssetPromise;
}

function makeHueTexture(source, { hue, sat, brt }) {
  const width = source.width || source.naturalWidth || 1024;
  const height = source.height || source.naturalHeight || 1024;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) return null;
  context.filter = `hue-rotate(${hue}deg) saturate(${sat}) brightness(${brt})`;
  context.drawImage(source, 0, 0, width, height);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.flipY = false;
  texture.needsUpdate = true;
  return texture;
}

export function createKoiScene(canvas) {
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: true,
      antialias: false,
      powerPreference: 'low-power',
    });
  } catch (error) {
    console.warn('[koi] WebGL is unavailable', error);
    return { activate() {}, deactivate() {}, dispose() {} };
  }

  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.25));
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 100);
  camera.position.set(0, 0, 12);
  scene.add(new THREE.AmbientLight(0xffffff, 0.7));
  const keyLight = new THREE.DirectionalLight(0xfff5e0, 0.85);
  keyLight.position.set(3, 8, 4);
  scene.add(keyLight);
  const fillLight = new THREE.DirectionalLight(0xffffff, 0.4);
  fillLight.position.set(-4, -2, 3);
  scene.add(fillLight);

  const fish = [];
  const hueTextures = [];
  const timers = new Set();
  const mouse = new THREE.Vector2(-10, -10);
  const mouseWorld = new THREE.Vector3();
  const raycaster = new THREE.Raycaster();
  const mousePlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 2);
  const modelCenter = new THREE.Vector3();
  const alignmentQuat = new THREE.Quaternion();

  const tmpDir = new THREE.Vector3();
  const fwd = new THREE.Vector3();
  const right = new THREE.Vector3();
  const upAxis = new THREE.Vector3();
  const curDir = new THREE.Vector3();
  const targetDir = new THREE.Vector3();
  const axis = new THREE.Vector3();
  const worldUp = new THREE.Vector3(0, 1, 0);
  const basis = new THREE.Matrix4();
  const targetQuaternion = new THREE.Quaternion();
  const flockTmp = new THREE.Vector3();

  let template = null;
  let swimClip = null;
  let baseScale = 1;
  let loaded = false;
  let active = false;
  let disposed = false;
  let pageVisible = document.visibilityState !== 'hidden';
  let visibility = 0;
  let animationFrame = 0;
  let lastTime = performance.now();
  let accumulator = 0;

  function resize() {
    const width = Math.max(1, canvas.clientWidth || window.innerWidth);
    const height = Math.max(1, canvas.clientHeight || window.innerHeight);
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }

  function schedule(callback, delay) {
    const timer = window.setTimeout(() => {
      timers.delete(timer);
      if (!disposed) callback();
    }, delay);
    timers.add(timer);
  }

  function disposeFish(entry) {
    entry.action?.stop();
    entry.mixer?.stopAllAction();
    if (entry.mixer && entry.model) entry.mixer.uncacheRoot(entry.model);
    scene.remove(entry.mesh);
    entry.materials.forEach((material) => material.dispose());
  }

  function applyFlocking(entry) {
    const neighbors = [];
    for (const other of fish) {
      if (other === entry) continue;
      const dx = other.mesh.position.x - entry.mesh.position.x;
      const dy = other.mesh.position.y - entry.mesh.position.y;
      const dz = other.mesh.position.z - entry.mesh.position.z;
      const distanceSquared = dx * dx + dy * dy + dz * dz;
      if (distanceSquared < FLOCK_RADIUS * FLOCK_RADIUS) {
        neighbors.push({ other, distanceSquared, dx, dy, dz });
      }
    }
    if (!neighbors.length) return;
    neighbors.sort((a, b) => a.distanceSquared - b.distanceSquared);
    const closest = neighbors.slice(0, FLOCK_MAX_NEIGHBORS);

    let avgPx = 0;
    let avgPy = 0;
    let avgPz = 0;
    let avgVx = 0;
    let avgVy = 0;
    let avgVz = 0;
    let sepX = 0;
    let sepY = 0;
    let sepZ = 0;
    for (const neighbor of closest) {
      avgPx += neighbor.other.mesh.position.x;
      avgPy += neighbor.other.mesh.position.y;
      avgPz += neighbor.other.mesh.position.z;
      avgVx += neighbor.other.velocity.x;
      avgVy += neighbor.other.velocity.y;
      avgVz += neighbor.other.velocity.z;
      if (
        neighbor.distanceSquared < SEPARATION_DIST * SEPARATION_DIST
        && neighbor.distanceSquared > 0.01
      ) {
        const distance = Math.sqrt(neighbor.distanceSquared);
        const push = (SEPARATION_DIST - distance) / SEPARATION_DIST;
        sepX -= (neighbor.dx / distance) * push;
        sepY -= (neighbor.dy / distance) * push;
        sepZ -= (neighbor.dz / distance) * push;
      }
    }

    const divisor = 1 / closest.length;
    avgPx *= divisor;
    avgPy *= divisor;
    avgPz *= divisor;
    avgVx *= divisor;
    avgVy *= divisor;
    avgVz *= divisor;
    entry.velocity.x += (avgVx - entry.velocity.x) * ALIGN_W;
    entry.velocity.y += (avgVy - entry.velocity.y) * ALIGN_W;
    entry.velocity.z += (avgVz - entry.velocity.z) * ALIGN_W;
    entry.velocity.x += (avgPx - entry.mesh.position.x) * COHESION_W;
    entry.velocity.y += (avgPy - entry.mesh.position.y) * COHESION_W;
    entry.velocity.z += (avgPz - entry.mesh.position.z) * COHESION_W;
    entry.velocity.x += sepX * SEPARATION_W;
    entry.velocity.y += sepY * SEPARATION_W;
    entry.velocity.z += sepZ * SEPARATION_W;
  }

  function orientFish(entry, deltaTime) {
    if (entry.velocity.lengthSq() < 0.0001) return;
    targetDir.copy(entry.velocity).normalize();
    curDir.copy(entry.orientDir);
    if (curDir.lengthSq() < 0.0001) {
      entry.orientDir.copy(targetDir);
      curDir.copy(targetDir);
    } else {
      curDir.normalize();
    }

    const dot = Math.max(-1, Math.min(1, curDir.dot(targetDir)));
    const angleToTarget = Math.acos(dot);
    const maxStep = MAX_TURN_RATE * deltaTime;
    if (angleToTarget <= maxStep || angleToTarget < 0.001) {
      entry.orientDir.copy(targetDir);
    } else {
      axis.crossVectors(curDir, targetDir);
      if (axis.lengthSq() > 0.0001) {
        axis.normalize();
      } else {
        axis.copy(worldUp);
        if (Math.abs(axis.dot(curDir)) > 0.99) axis.set(1, 0, 0);
      }
      entry.orientDir.copy(curDir).applyAxisAngle(axis, maxStep).normalize();
    }

    fwd.copy(entry.orientDir);
    right.crossVectors(fwd, worldUp);
    if (right.lengthSq() < 0.001) right.set(0, 0, 1);
    else right.normalize();
    upAxis.crossVectors(right, fwd).normalize();
    basis.makeBasis(fwd, upAxis, right);
    targetQuaternion.setFromRotationMatrix(basis);
    entry.mesh.quaternion.copy(targetQuaternion);
  }

  function spawnFish(position, options = {}) {
    if (!loaded || disposed || !template) return null;
    if (fish.length >= FISH_MAX) {
      const oldest = fish.shift();
      disposeFish(oldest);
    }

    const model = cloneSkeleton(template);
    model.position.sub(modelCenter);
    const hueTexture = hueTextures.length
      ? hueTextures[Math.floor(Math.random() * hueTextures.length)]
      : null;
    const materials = [];
    model.traverse((object) => {
      if (!object.isMesh || !object.material) return;
      object.material = object.material.clone();
      object.material.transparent = true;
      if (hueTexture) object.material.map = hueTexture;
      if (object.material.emissive) {
        object.material.emissive.setRGB(0.08, 0.06, 0.05);
        if ('emissiveIntensity' in object.material) object.material.emissiveIntensity = 1;
      }
      object.material.needsUpdate = true;
      materials.push(object.material);
    });

    const inner = new THREE.Group();
    inner.add(model);
    inner.quaternion.copy(alignmentQuat);
    const wrapper = new THREE.Group();
    wrapper.add(inner);
    let sizeMultiplier;
    if (options.sizeMult !== undefined) sizeMultiplier = options.sizeMult;
    else if (options.small) sizeMultiplier = 0.25 + Math.random() * 0.22;
    else sizeMultiplier = 0.55 + Math.random();
    const small = sizeMultiplier < 0.55;
    wrapper.scale.setScalar(baseScale * sizeMultiplier);
    wrapper.position.copy(position);
    scene.add(wrapper);

    let mixer = null;
    let action = null;
    if (swimClip) {
      mixer = new THREE.AnimationMixer(model);
      action = mixer.clipAction(swimClip);
      action.timeScale = 1.1 + Math.random() * 0.5;
      action.time = Math.random() * swimClip.duration;
      action.play();
    }

    const speedScale = small ? 0.45 : 1;
    const velocity = new THREE.Vector3(
      (Math.random() - 0.5) * 0.3 * speedScale,
      (Math.random() - 0.5) * 0.12 * speedScale,
      (Math.random() - 0.5) * 0.22 * speedScale,
    );
    const orientDir = velocity.lengthSq() > 0.0001
      ? velocity.clone().normalize()
      : new THREE.Vector3(1, 0, 0);
    const entry = {
      mesh: wrapper,
      model,
      mixer,
      action,
      materials,
      velocity,
      orientDir,
      fleeFatigue: 0,
      phase: Math.random() * Math.PI * 2,
      small,
      spawnFade: options.fadeIn
        ? (options.spawnFadeStart !== undefined ? options.spawnFadeStart : 0.5)
        : 1,
      fadeDuration: options.fadeIn || 0,
    };
    fish.push(entry);
    return entry;
  }

  function updateMouseWorld() {
    raycaster.setFromCamera(mouse, camera);
    return raycaster.ray.intersectPlane(mousePlane, mouseWorld);
  }

  function updateFish(deltaTime, time) {
    if (!loaded || visibility < 0.02 || !updateMouseWorld()) return;
    const mouseActive = mouse.x > -5;

    for (const entry of fish) {
      if (mouseActive) {
        tmpDir.subVectors(entry.mesh.position, mouseWorld);
        tmpDir.z *= 0.25;
        const distanceSquared = tmpDir.lengthSq();
        const fleeRadius = 2.6;
        if (distanceSquared < fleeRadius * fleeRadius && distanceSquared > 0.01) {
          const distance = Math.sqrt(distanceSquared);
          tmpDir.normalize();
          const dotForward = entry.orientDir.dot(tmpDir);
          if (dotForward < 0) {
            tmpDir.x -= entry.orientDir.x * dotForward;
            tmpDir.y -= entry.orientDir.y * dotForward;
            tmpDir.z -= entry.orientDir.z * dotForward;
            const length = Math.hypot(tmpDir.x, tmpDir.y, tmpDir.z);
            if (length < 0.15) {
              tmpDir.crossVectors(entry.orientDir, worldUp);
              if (tmpDir.lengthSq() < 0.01) tmpDir.set(0, 1, 0);
              else tmpDir.normalize();
              if (entry.phase > Math.PI) tmpDir.multiplyScalar(-1);
            } else {
              tmpDir.multiplyScalar(1 / length);
            }
          }
          const force = 1 - distance / fleeRadius;
          const burst = 0.28 * force * force * (1 - entry.fleeFatigue * 0.65);
          entry.velocity.x += tmpDir.x * burst;
          entry.velocity.y += tmpDir.y * burst;
          entry.velocity.z += tmpDir.z * burst * 0.5;
          entry.fleeFatigue = Math.min(1, entry.fleeFatigue + force * 0.3);
        } else {
          entry.fleeFatigue *= 0.88;
        }
      } else {
        entry.fleeFatigue *= 0.9;
      }

      entry.velocity.x += (Math.random() - 0.5) * 0.0035;
      entry.velocity.y += (Math.random() - 0.5) * 0.002;
      entry.velocity.z += (Math.random() - 0.5) * 0.0025;
      const clipDuration = entry.action?.getClip().duration || 1;
      const swimPhase = entry.action
        ? (entry.action.time % clipDuration) / clipDuration
        : (time * 0.16 + entry.phase) % 1;
      const pulse = 0.5 + 0.5 * Math.cos(swimPhase * Math.PI * 2);
      const thrust = 0.0022 + pulse * 0.003;
      entry.velocity.x += entry.orientDir.x * thrust;
      entry.velocity.y += entry.orientDir.y * thrust;
      entry.velocity.z += entry.orientDir.z * thrust;

      applyFlocking(entry);
      if (Math.abs(entry.mesh.position.x) > 14) {
        entry.velocity.x -= Math.sign(entry.mesh.position.x) * 0.02;
      }
      if (Math.abs(entry.mesh.position.y) > 6.5) {
        entry.velocity.y -= Math.sign(entry.mesh.position.y) * 0.02;
      }
      if (entry.mesh.position.z > 4) entry.velocity.z -= 0.02;
      if (entry.mesh.position.z < -10) entry.velocity.z += 0.02;

      const damping = 0.93 + entry.fleeFatigue * 0.05;
      entry.velocity.multiplyScalar(damping);
      const maxSpeed = (entry.small ? 0.06 : 0.075) + entry.fleeFatigue * 0.3;
      if (entry.velocity.lengthSq() > maxSpeed * maxSpeed) {
        entry.velocity.normalize().multiplyScalar(maxSpeed);
      }
      const forwardComponent = entry.velocity.dot(entry.orientDir);
      if (forwardComponent < 0) {
        entry.velocity.x -= entry.orientDir.x * forwardComponent;
        entry.velocity.y -= entry.orientDir.y * forwardComponent;
        entry.velocity.z -= entry.orientDir.z * forwardComponent;
        entry.velocity.x += entry.orientDir.x * 0.025;
        entry.velocity.y += entry.orientDir.y * 0.025;
        entry.velocity.z += entry.orientDir.z * 0.025;
      }

      entry.mesh.position.add(entry.velocity);
      orientFish(entry, deltaTime);
      const speed = entry.velocity.length();
      const liveness = Math.max(0, 1 - speed / 0.2);
      entry.mesh.position.y += Math.sin(time * 0.9 + entry.phase) * 0.0015 * liveness;
      entry.mesh.rotation.z += Math.sin(time * 0.7 + entry.phase) * 0.001 * liveness;
      if (entry.action) entry.action.timeScale = 0.9 + speed * 7 + entry.fleeFatigue * 2.5;
      entry.mixer?.update(deltaTime);

      if (entry.spawnFade < 1 && entry.fadeDuration > 0) {
        entry.spawnFade = Math.min(1, entry.spawnFade + (deltaTime * 1000) / entry.fadeDuration);
      }
      const opacity = visibility * entry.spawnFade;
      entry.materials.forEach((material) => { material.opacity = opacity; });
    }
  }

  function ensureAnimationFrame() {
    if (animationFrame || disposed || !pageVisible) return;
    lastTime = performance.now();
    animationFrame = window.requestAnimationFrame(tick);
  }

  function tick(now) {
    animationFrame = 0;
    if (disposed || !pageVisible) return;
    const deltaTime = Math.min(0.05, (now - lastTime) / 1000);
    lastTime = now;
    const fadeStep = (deltaTime * 1000) / FADE_MS;
    visibility = active
      ? Math.min(1, visibility + fadeStep)
      : Math.max(0, visibility - fadeStep);

    if (!loaded || visibility < 0.02) {
      renderer.clear();
    } else {
      accumulator = Math.min(FIXED_STEP * 3, accumulator + deltaTime);
      while (accumulator >= FIXED_STEP) {
        updateFish(FIXED_STEP, now * 0.001);
        accumulator -= FIXED_STEP;
      }
      renderer.render(scene, camera);
    }

    if (active || visibility > 0) ensureAnimationFrame();
  }

  function onPointerMove(event) {
    const bounds = canvas.getBoundingClientRect();
    if (!bounds.width || !bounds.height) return;
    mouse.x = ((event.clientX - bounds.left) / bounds.width) * 2 - 1;
    mouse.y = -((event.clientY - bounds.top) / bounds.height) * 2 + 1;
  }

  function onPointerLeave() {
    mouse.set(-10, -10);
  }

  function onClick(event) {
    if (!active || !loaded || visibility < 0.5) return;
    const target = event.target instanceof Element ? event.target : null;
    if (target?.closest('.project-card, nav, a, button, .links, .music-player')) return;
    const bounds = canvas.getBoundingClientRect();
    const clickMouse = new THREE.Vector2(
      ((event.clientX - bounds.left) / bounds.width) * 2 - 1,
      -((event.clientY - bounds.top) / bounds.height) * 2 + 1,
    );
    raycaster.setFromCamera(clickMouse, camera);
    const spawnPosition = new THREE.Vector3();
    if (!raycaster.ray.intersectPlane(mousePlane, spawnPosition)) return;

    const count = 3 + Math.floor(Math.random() * 2);
    const startAngle = Math.random() * Math.PI * 2;
    for (let index = 0; index < count; index += 1) {
      const delay = index * (320 + Math.random() * 250);
      schedule(() => {
        const angle = startAngle
          + (index / count) * Math.PI * 2
          + (Math.random() - 0.5) * 0.5;
        const radius = 3 + Math.random() * 1.2;
        const offset = new THREE.Vector3(
          Math.cos(angle) * radius,
          (Math.random() - 0.5) * 1.2,
          Math.sin(angle) * radius * 0.7,
        );
        const entry = spawnFish(spawnPosition.clone().add(offset), {
          fadeIn: 1400,
          spawnFadeStart: 0.05,
          sizeMult: 0.55 + Math.random() * 0.55,
        });
        if (!entry) return;
        const inward = flockTmp.subVectors(spawnPosition, entry.mesh.position).normalize();
        entry.velocity.copy(inward).multiplyScalar(0.045 + Math.random() * 0.015);
        entry.orientDir.copy(inward);
      }, delay);
    }
  }

  function onVisibilityChange() {
    pageVisible = document.visibilityState !== 'hidden';
    if (pageVisible && (active || visibility > 0)) ensureAnimationFrame();
  }

  function spawnInitialSchools() {
    const fishPerGroup = Math.ceil(INITIAL_COUNT / INITIAL_GROUPS);
    let spawned = 0;
    for (let group = 0; group < INITIAL_GROUPS; group += 1) {
      const groupCenter = new THREE.Vector3(
        (Math.random() - 0.5) * 20,
        (Math.random() - 0.5) * 8,
        (Math.random() - 0.5) * 10 - 2,
      );
      const groupHeading = new THREE.Vector3(
        Math.random() - 0.5,
        (Math.random() - 0.5) * 0.3,
        Math.random() - 0.5,
      ).normalize().multiplyScalar(0.035);
      for (let index = 0; index < fishPerGroup && spawned < INITIAL_COUNT; index += 1) {
        const spawnIndex = spawned;
        spawned += 1;
        schedule(() => {
          const offset = new THREE.Vector3(
            (Math.random() - 0.5) * 2.2,
            (Math.random() - 0.5) * 1.4,
            (Math.random() - 0.5) * 1.6,
          );
          const entry = spawnFish(groupCenter.clone().add(offset), { fadeIn: 700 });
          if (!entry) return;
          entry.velocity.copy(groupHeading).add(new THREE.Vector3(
            (Math.random() - 0.5) * 0.012,
            (Math.random() - 0.5) * 0.006,
            (Math.random() - 0.5) * 0.012,
          ));
          entry.orientDir.copy(entry.velocity).normalize();
        }, spawnIndex * 160);
      }
    }
  }

  resize();
  window.addEventListener('resize', resize);
  window.addEventListener('pointermove', onPointerMove);
  window.addEventListener('pointerleave', onPointerLeave);
  window.addEventListener('click', onClick);
  document.addEventListener('visibilitychange', onVisibilityChange);

  loadKoiAsset().then((gltf) => {
    if (disposed) return;
    template = cloneSkeleton(gltf.scene);
    swimClip = gltf.animations[0] || null;
    template.updateMatrixWorld(true);
    const bounds = new THREE.Box3().setFromObject(template);
    const size = bounds.getSize(new THREE.Vector3());
    modelCenter.copy(bounds.getCenter(new THREE.Vector3()));
    if (size.z >= size.x && size.z >= size.y) {
      alignmentQuat.setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 2);
    } else if (size.y >= size.x && size.y >= size.z) {
      alignmentQuat.setFromAxisAngle(new THREE.Vector3(0, 0, 1), -Math.PI / 2);
    }
    baseScale = 1.6 / Math.max(size.x, size.y, size.z);

    let baseTextureImage = null;
    template.traverse((object) => {
      if (!baseTextureImage && object.isMesh && object.material?.map?.image) {
        baseTextureImage = object.material.map.image;
      }
    });
    if (baseTextureImage) {
      for (const variant of HUE_VARIANTS) {
        try {
          const texture = makeHueTexture(baseTextureImage, variant);
          if (texture) hueTextures.push(texture);
        } catch (error) {
          console.warn('[koi] Could not create a color variant', error);
        }
      }
    }

    loaded = true;
    spawnInitialSchools();
    if (active) ensureAnimationFrame();
  }).catch((error) => {
    console.error('[koi] GLB load failed', error);
  });

  return {
    activate() {
      if (disposed) return;
      active = true;
      resize();
      ensureAnimationFrame();
    },
    deactivate() {
      if (disposed) return;
      active = false;
      ensureAnimationFrame();
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      active = false;
      if (animationFrame) window.cancelAnimationFrame(animationFrame);
      animationFrame = 0;
      timers.forEach((timer) => window.clearTimeout(timer));
      timers.clear();
      window.removeEventListener('resize', resize);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerleave', onPointerLeave);
      window.removeEventListener('click', onClick);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      while (fish.length) disposeFish(fish.pop());
      hueTextures.forEach((texture) => texture.dispose());
      renderer.clear();
      renderer.renderLists.dispose();
      renderer.dispose();
    },
  };
}
