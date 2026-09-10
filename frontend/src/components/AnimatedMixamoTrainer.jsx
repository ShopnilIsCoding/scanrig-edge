import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { clone as cloneSkeleton } from 'three/examples/jsm/utils/SkeletonUtils.js';
import * as THREE from 'three';
import { normalizeMixamoClip, normalizeMixamoRig } from '../utils/mixamoRig';

export const TRAINER_MODELS = {
  male: {
    name: 'James',
    path: '/models/James.fbx?v=13',
    accent: '#4de8d1',
  },
  female: {
    name: 'Jody',
    path: '/models/Jody.fbx?v=13',
    accent: '#ff8a3d',
  },
};

export const TRAINER_ANIMATIONS = {
  breathing: '/animations/BreathingIdle.fbx?v=13',
  offensiveIdle: '/animations/OffensiveIdle.fbx?v=13',
  victory: '/animations/Victory.fbx?v=13',
  talking: '/animations/Talking.fbx?v=13',
  bicepCurl: '/animations/BicepCurl.fbx?v=13',
  walking: '/animations/Walking.fbx?v=13',
  running: '/animations/Running.fbx?v=13',
  standingGreeting: '/animations/StandingGreeting.fbx?v=13',
  thoughtfulHeadShake: '/animations/ThoughtfulHeadShake.fbx?v=13',
  weightShift: '/animations/WeightShift.fbx?v=13',
  bored: '/animations/Bored.fbx?v=13',
};

const modelSourceCache = new Map();
const modelRequestCache = new Map();
const animationClipCache = new Map();
const animationRequestCache = new Map();

const trainerBundleListeners = new Set();
let trainerBundlePromise = null;
let trainerBundleState = {
  status: 'idle',
  progress: 0,
  completed: 0,
  total: 0,
  warnings: [],
};

function publishTrainerBundle(next) {
  trainerBundleState = { ...trainerBundleState, ...next };
  trainerBundleListeners.forEach((listener) => listener(trainerBundleState));
}

export function getTrainerAssetBundleState() {
  return trainerBundleState;
}

export function preloadTrainerAssetBundle() {
  if (trainerBundleState.status === 'ready') return Promise.resolve(trainerBundleState);
  if (trainerBundlePromise) return trainerBundlePromise;

  // Parse the two large skinned FBX trainers first, then the motion pack.
  // Doing this as a controlled queue is slower than firing 13 FBX parses at
  // once, but it avoids browser CPU/GPU spikes and gives us one reliable
  // readiness point before any visible trainer is allowed to mount.
  const tasks = [
    ...Object.values(TRAINER_MODELS).map((trainer) => ({
      id: `model:${trainer.name}`,
      load: () => requestTrainerSource(trainer.path),
    })),
    ...Object.entries(TRAINER_ANIMATIONS).map(([name, path]) => ({
      id: `motion:${name}`,
      load: () => requestAnimationClip(path, name),
    })),
  ];

  publishTrainerBundle({ status: 'loading', progress: 0, completed: 0, total: tasks.length, warnings: [] });

  trainerBundlePromise = (async () => {
    const warnings = [];
    let completed = 0;

    for (const task of tasks) {
      try {
        const value = await task.load();
        if (!value) throw new Error(`${task.id} returned no usable asset`);
      } catch (error) {
        const message = `${task.id} failed to load`;
        warnings.push(message);
        console.error(`[ScanRig] ${message}`, error);
        publishTrainerBundle({
          status: 'error',
          progress: Math.round((completed / tasks.length) * 100),
          completed,
          total: tasks.length,
          warnings: [...warnings],
        });
        return trainerBundleState;
      }

      completed += 1;
      publishTrainerBundle({
        status: 'loading',
        completed,
        total: tasks.length,
        progress: Math.round((completed / tasks.length) * 100),
        warnings: [...warnings],
      });

      // Yield between FBX parses so React can paint the loading popup and the
      // browser can release parser work before the next heavy asset starts.
      await new Promise((resolve) => window.setTimeout(resolve, 20));
    }

    publishTrainerBundle({
      status: 'ready',
      progress: 100,
      completed: tasks.length,
      total: tasks.length,
      warnings: [],
    });
    return trainerBundleState;
  })().finally(() => {
    trainerBundlePromise = null;
  });

  return trainerBundlePromise;
}

export function useTrainerAssetBundle() {
  const [state, setState] = useState(() => trainerBundleState);

  useEffect(() => {
    const listener = (next) => setState({ ...next });
    trainerBundleListeners.add(listener);
    preloadTrainerAssetBundle();
    return () => trainerBundleListeners.delete(listener);
  }, []);

  return state;
}

function requestTrainerSource(path) {
  if (!path) return Promise.reject(new Error('Missing trainer path'));
  if (modelSourceCache.has(path)) return Promise.resolve(modelSourceCache.get(path));
  if (modelRequestCache.has(path)) return modelRequestCache.get(path);

  const request = new Promise((resolve, reject) => {
    const manager = new THREE.LoadingManager();
    const loader = new FBXLoader(manager);
    loader.load(
      path,
      (asset) => {
        if (!asset?.animations?.[0]) {
          reject(new Error(`Trainer ${path} has no embedded Idle animation`));
          return;
        }
        modelSourceCache.set(path, asset);
        resolve(asset);
      },
      undefined,
      (error) => reject(error),
    );
  }).finally(() => {
    modelRequestCache.delete(path);
  });

  modelRequestCache.set(path, request);
  return request;
}

function useTrainerSource(path) {
  const [, refresh] = useState(0);
  const source = modelSourceCache.get(path) || null;

  useEffect(() => {
    let cancelled = false;
    if (!path || modelSourceCache.has(path)) return undefined;

    requestTrainerSource(path)
      .then(() => {
        if (!cancelled) refresh((value) => value + 1);
      })
      .catch((error) => {
        console.error(`[ScanRig] Trainer model failed: ${path}`, error);
        if (!cancelled) refresh((value) => value + 1);
      });

    return () => {
      cancelled = true;
    };
  }, [path]);

  return {
    source,
    status: source ? 'ready' : 'loading',
    error: null,
  };
}

function keepAnimationInPlace(sourceClip, name) {
  const clip = normalizeMixamoClip(sourceClip);
  clip.name = name;

  clip.tracks.forEach((track) => {
    if (track.name === 'Hips.position' && track.values?.length >= 3) {
      const values = track.values;
      const x = values[0];
      const z = values[2];
      for (let index = 0; index < values.length; index += 3) {
        values[index] = x;
        values[index + 2] = z;
      }
    }
  });

  return clip;
}

function requestAnimationClip(path, name) {
  if (!path) return Promise.resolve(null);
  if (animationClipCache.has(path)) return Promise.resolve(animationClipCache.get(path));
  if (animationRequestCache.has(path)) return animationRequestCache.get(path);

  const request = new Promise((resolve) => {
    const manager = new THREE.LoadingManager();
    const loader = new FBXLoader(manager);

    loader.load(
      path,
      (asset) => {
        const sourceClip = asset?.animations?.[0];
        if (!sourceClip) {
          console.warn(`[ScanRig] No animation clip found in ${path}`);
          resolve(null);
          return;
        }

        const clip = keepAnimationInPlace(sourceClip, name);
        animationClipCache.set(path, clip);
        resolve(clip);
      },
      undefined,
      (error) => {
        console.warn(`[ScanRig] Optional animation failed: ${path}`, error);
        resolve(null);
      },
    );
  }).finally(() => {
    animationRequestCache.delete(path);
  });

  animationRequestCache.set(path, request);
  return request;
}

function getEmbeddedIdleClip(source, name = 'defaultIdle') {
  const sourceClip = source?.animations?.[0];
  if (!sourceClip) return null;
  return keepAnimationInPlace(sourceClip, name);
}

function useOptionalAnimationClip(path, name) {
  const [, refresh] = useState(0);
  const clip = path ? (animationClipCache.get(path) || null) : null;

  useEffect(() => {
    let cancelled = false;
    if (!path || animationClipCache.has(path)) return undefined;

    requestAnimationClip(path, name).then(() => {
      if (!cancelled) refresh((value) => value + 1);
    });

    return () => {
      cancelled = true;
    };
  }, [path, name]);

  // Never return the clip from the previous path while the next path is changing.
  // This was the source of partial-arm / wrong-pose states during Back/Continue.
  return clip;
}

function fitTrainer(source, targetHeight, targetWidth) {
  const next = cloneSkeleton(source);
  normalizeMixamoRig(next);

  next.traverse((node) => {
    if (!node.isMesh && !node.isSkinnedMesh) return;
    node.castShadow = true;
    node.receiveShadow = true;
    node.frustumCulled = false;

    const materials = Array.isArray(node.material) ? node.material : [node.material];
    materials.filter(Boolean).forEach((material) => {
      material.side = THREE.FrontSide;
      material.wireframe = false;
      material.transparent = Boolean(material.transparent);
      material.needsUpdate = true;
    });
  });

  next.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(next);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const heightScale = size.y > 0 ? targetHeight / size.y : 0.01;
  const widthScale = size.x > 0 ? targetWidth / size.x : heightScale;
  const scale = Math.min(heightScale, widthScale);

  return {
    object: next,
    scale,
    offset: new THREE.Vector3(-center.x, -box.min.y, -center.z),
  };
}

function HologramBody({ accent = '#4de8d1', failed = false }) {
  const group = useRef();
  const scan = useRef();

  useFrame((state, delta) => {
    const t = state.clock.elapsedTime;
    if (group.current) {
      group.current.rotation.y += delta * 0.16;
      group.current.position.y = -0.95 + Math.sin(t * 1.8) * 0.025;
    }
    if (scan.current) {
      scan.current.position.y = 0.05 + ((Math.sin(t * 1.8) + 1) / 2) * 2.7;
      scan.current.material.opacity = 0.14 + ((Math.sin(t * 3.6) + 1) / 2) * 0.12;
    }
  });

  const opacity = failed ? 0.12 : 0.22;

  return (
    <group ref={group} position={[0, -0.95, 0]}>
      <mesh position={[0, 2.52, 0]}>
        <sphereGeometry args={[0.26, 18, 14]} />
        <meshBasicMaterial color={accent} wireframe transparent opacity={opacity} toneMapped={false} />
      </mesh>
      <mesh position={[0, 1.65, 0]}>
        <capsuleGeometry args={[0.32, 1.15, 8, 14]} />
        <meshBasicMaterial color={accent} wireframe transparent opacity={opacity} toneMapped={false} />
      </mesh>
      <mesh position={[-0.47, 1.63, 0]} rotation={[0, 0, -0.16]}>
        <capsuleGeometry args={[0.09, 0.9, 6, 10]} />
        <meshBasicMaterial color={accent} wireframe transparent opacity={opacity} toneMapped={false} />
      </mesh>
      <mesh position={[0.47, 1.63, 0]} rotation={[0, 0, 0.16]}>
        <capsuleGeometry args={[0.09, 0.9, 6, 10]} />
        <meshBasicMaterial color={accent} wireframe transparent opacity={opacity} toneMapped={false} />
      </mesh>
      <mesh position={[-0.20, 0.45, 0]} rotation={[0, 0, 0.04]}>
        <capsuleGeometry args={[0.11, 1.25, 6, 10]} />
        <meshBasicMaterial color={accent} wireframe transparent opacity={opacity} toneMapped={false} />
      </mesh>
      <mesh position={[0.20, 0.45, 0]} rotation={[0, 0, -0.04]}>
        <capsuleGeometry args={[0.11, 1.25, 6, 10]} />
        <meshBasicMaterial color={accent} wireframe transparent opacity={opacity} toneMapped={false} />
      </mesh>
      <mesh ref={scan} position={[0, 1.2, 0.32]}>
        <planeGeometry args={[1.8, 0.018]} />
        <meshBasicMaterial color={accent} transparent opacity={0.22} toneMapped={false} depthWrite={false} />
      </mesh>
    </group>
  );
}

function TrainerRuntime({
  source,
  trainer,
  animation,
  transitionAnimation,
  transitionKey,
  transitionDurationMs,
  strictMotion,
  targetHeight,
  targetWidth,
  baseY,
  rotationY,
  pointerTracking,
  motionScale,
  onReady,
  idleClip,
  stageClip,
  transitionClip,
  proceduralExercise,
}) {
  const wrapper = useRef();
  const onReadyRef = useRef(onReady);

  useEffect(() => {
    onReadyRef.current = onReady;
  }, [onReady]);

  // The model is not mounted until its embedded skinned idle exists. We immediately
  // sample that clip before the first rendered frame, so the raw Mixamo T-pose
  // never flashes between model/animation changes.
  const runtime = useMemo(() => {
    if (!source || !idleClip) return null;

    try {
      const model = fitTrainer(source, targetHeight, targetWidth);
      const mixer = new THREE.AnimationMixer(model.object);
      const idleAction = mixer.clipAction(idleClip, model.object);
      idleAction.reset().setLoop(THREE.LoopRepeat, Infinity).play();
      // Advance the embedded idle away from frame zero before the character
      // can ever become visible. Some FBX exports briefly retain their bind
      // pose at the beginning of the take, so sampling deeper into the idle
      // gives the skin a settled first visible pose.
      const primeTime = Math.min(0.4, Math.max(1 / 20, idleClip.duration * 0.18));
      mixer.update(primeTime);
      model.object.updateMatrixWorld(true);

      // Capture a complete, settled Idle pose. Mixamo clips do not always key
      // every bone. Restoring this snapshot before every new motion prevents a
      // shoulder/arm/leg from inheriting the previous action's transform.
      const idlePose = new Map();
      model.object.traverse((node) => {
        if (!node.isBone) return;
        idlePose.set(node, {
          position: node.position.clone(),
          quaternion: node.quaternion.clone(),
          scale: node.scale.clone(),
        });
      });

      return { model, mixer, idleAction, idlePose, idlePrimeTime: primeTime };
    } catch (error) {
      console.error('[ScanRig] Trainer runtime bootstrap failed; keeping hologram fallback.', error);
      return null;
    }
  }, [source, idleClip, targetHeight, targetWidth]);

  const proceduralBones = useMemo(() => {
    if (!runtime) return {};
    const names = ['Hips','Spine','Spine1','Spine2','LeftArm','RightArm','LeftForeArm','RightForeArm','LeftUpLeg','RightUpLeg','LeftLeg','RightLeg'];
    return Object.fromEntries(names.map((name) => [name, runtime.model.object.getObjectByName(name)]));
  }, [runtime]);

  const applyProceduralPose = (t) => {
    if (!runtime || !proceduralExercise) return;
    // Start every frame from the settled skinned idle so a procedural demo can
    // never accumulate rotations or expose the Mixamo bind pose.
    runtime.idlePose.forEach((pose, bone) => {
      bone.position.copy(pose.position);
      bone.quaternion.copy(pose.quaternion);
      bone.scale.copy(pose.scale);
    });
    const q = new THREE.Quaternion();
    const rotate = (bone, x=0, y=0, z=0) => {
      if (!bone) return;
      q.setFromEuler(new THREE.Euler(x,y,z,'XYZ'));
      bone.quaternion.multiply(q);
    };
    const cycle = (Math.sin(t * Math.PI * 1.7) + 1) / 2;
    const alternate = (Math.sin(t * Math.PI * 1.9) + 1) / 2;
    const B = proceduralBones;
    const hipsPose = B.Hips ? runtime.idlePose.get(B.Hips) : null;

    if (proceduralExercise === 'jumping-jack') {
      rotate(B.LeftArm, 0, 0, -1.55 * cycle);
      rotate(B.RightArm, 0, 0, 1.55 * cycle);
      rotate(B.LeftForeArm, 0, 0, -.18 * cycle);
      rotate(B.RightForeArm, 0, 0, .18 * cycle);
      rotate(B.LeftUpLeg, 0, 0, -.28 * cycle);
      rotate(B.RightUpLeg, 0, 0, .28 * cycle);
    } else if (proceduralExercise === 'squat') {
      if (B.Hips && hipsPose) B.Hips.position.y = hipsPose.position.y - 19 * cycle;
      rotate(B.LeftUpLeg, -.76 * cycle, 0, -.06);
      rotate(B.RightUpLeg, -.76 * cycle, 0, .06);
      rotate(B.LeftLeg, 1.15 * cycle, 0, 0);
      rotate(B.RightLeg, 1.15 * cycle, 0, 0);
      rotate(B.Spine, .18 * cycle, 0, 0);
    } else if (proceduralExercise === 'shoulder-press') {
      rotate(B.LeftArm, 0, 0, -(.45 + 1.0 * cycle));
      rotate(B.RightArm, 0, 0, .45 + 1.0 * cycle);
      rotate(B.LeftForeArm, 0, 0, -.9 * (1-cycle));
      rotate(B.RightForeArm, 0, 0, .9 * (1-cycle));
    } else if (proceduralExercise === 'high-knees') {
      const left = alternate;
      const right = 1 - alternate;
      rotate(B.LeftUpLeg, -1.05 * left, 0, 0);
      rotate(B.RightUpLeg, -1.05 * right, 0, 0);
      rotate(B.LeftLeg, 1.05 * left, 0, 0);
      rotate(B.RightLeg, 1.05 * right, 0, 0);
      if (B.Hips && hipsPose) B.Hips.position.y = hipsPose.position.y + 2.2 * Math.sin(t * Math.PI * 3.8);
    } else if (proceduralExercise === 'lunge') {
      if (B.Hips && hipsPose) B.Hips.position.y = hipsPose.position.y - 14 * cycle;
      rotate(B.LeftUpLeg, -.75 * cycle, 0, 0);
      rotate(B.LeftLeg, 1.0 * cycle, 0, 0);
      rotate(B.RightUpLeg, .42 * cycle, 0, 0);
      rotate(B.RightLeg, .6 * cycle, 0, 0);
      rotate(B.Spine, .08 * cycle, 0, 0);
    } else if (proceduralExercise === 'push-up') {
      const press = cycle;
      rotate(B.LeftArm, 0, 0, -.45);
      rotate(B.RightArm, 0, 0, .45);
      rotate(B.LeftForeArm, 0, -.9 * press, 0);
      rotate(B.RightForeArm, 0, .9 * press, 0);
    } else if (proceduralExercise === 'crunch') {
      rotate(B.Spine, 0, 0, -.45 * cycle);
      rotate(B.Spine1, 0, 0, -.42 * cycle);
      rotate(B.Spine2, 0, 0, -.25 * cycle);
      rotate(B.LeftUpLeg, 0, 0, -.55);
      rotate(B.RightUpLeg, 0, 0, -.55);
      rotate(B.LeftLeg, 0, 0, .9);
      rotate(B.RightLeg, 0, 0, .9);
    } else if (proceduralExercise === 'plank') {
      rotate(B.LeftArm, 0, 0, -.35);
      rotate(B.RightArm, 0, 0, .35);
      rotate(B.LeftForeArm, 0, -.85, 0);
      rotate(B.RightForeArm, 0, .85, 0);
    }
    runtime.model.object.updateMatrixWorld(true);
  };

  const actions = useMemo(() => {
    if (!runtime) return {};
    const next = { defaultIdle: runtime.idleAction };

    const addAction = (name, clip) => {
      if (!name || !clip) return;
      try {
        next[name] = runtime.mixer.clipAction(clip, runtime.model.object);
      } catch (error) {
        console.warn(`[ScanRig] Motion ${name} could not bind; using embedded idle.`, error);
      }
    };

    addAction(animation, stageClip);
    // Keep the old name as a compatibility alias only when no external breathing clip is bound.
    if (!next.breathing) next.breathing = runtime.idleAction;
    addAction(transitionAnimation, transitionClip);
    return next;
  }, [runtime, animation, stageClip, transitionAnimation, transitionClip]);

  const currentAction = useRef(null);
  const timerRef = useRef(null);
  const motionSequenceRef = useRef(0);
  const mountedRef = useRef(false);
  const mixerFailureLogged = useRef(false);
  const primeFrames = useRef(0);
  const [poseReady, setPoseReady] = useState(false);

  useEffect(() => {
    if (!runtime) return undefined;

    currentAction.current = runtime.idleAction;
    mountedRef.current = true;
    primeFrames.current = 0;
    setPoseReady(false);

    return () => {
      mountedRef.current = false;
      if (timerRef.current) window.clearTimeout(timerRef.current);
      runtime.mixer.stopAllAction();
      runtime.mixer.uncacheRoot(runtime.model.object);
    };
  }, [runtime]);

  const restoreIdleSkeleton = () => {
    if (!runtime) return;
    runtime.mixer.stopAllAction();
    runtime.idlePose.forEach((pose, bone) => {
      bone.position.copy(pose.position);
      bone.quaternion.copy(pose.quaternion);
      bone.scale.copy(pose.scale);
    });
    runtime.model.object.updateMatrixWorld(true);
  };

  const startEmbeddedIdle = () => {
    if (!runtime) return false;
    try {
      restoreIdleSkeleton();
      const idle = runtime.idleAction;
      idle.reset();
      idle.enabled = true;
      idle.setEffectiveTimeScale(1);
      idle.setEffectiveWeight(1);
      idle.setLoop(THREE.LoopRepeat, Infinity);
      idle.clampWhenFinished = false;
      idle.play();
      idle.time = Math.min(runtime.idlePrimeTime, Math.max(0, idle.getClip().duration - (1 / 30)));
      runtime.mixer.update(0);
      runtime.model.object.updateMatrixWorld(true);
      currentAction.current = idle;
      return true;
    } catch (error) {
      console.warn('[ScanRig] Embedded idle could not be restored.', error);
      return false;
    }
  };

  const fadeTo = (name, fade = 0.32, once = false, timeScale = 1) => {
    if (!runtime) return false;
    const next = actions[name] || actions.defaultIdle;
    if (!next) return false;

    try {
      // Onboarding uses a strict one-action controller. It prevents an interrupted
      // Back/Continue transition from leaving a second action with residual weight,
      // which was producing the one-arm and occasional bind-pose states.
      if (strictMotion) {
        // Always restore the full embedded Idle skeleton first. stopAllAction()
        // alone is not enough because an incoming clip can omit some bone tracks.
        // Without this reset those bones can keep the previous clip's transform,
        // which is what caused the partial T-pose / one-arm states.
        restoreIdleSkeleton();

        if (name === 'defaultIdle' || next === runtime.idleAction) {
          return startEmbeddedIdle();
        }

        next.reset();
        next.enabled = true;
        next.setEffectiveTimeScale(timeScale);
        next.setEffectiveWeight(1);
        next.setLoop(once ? THREE.LoopOnce : THREE.LoopRepeat, once ? 1 : Infinity);
        next.clampWhenFinished = once;
        next.play();

        const clip = next.getClip?.();
        if (clip?.duration) {
          const lead = Math.min(0.14, Math.max(1 / 30, clip.duration * 0.07));
          next.time = Math.max(0, Math.min(lead, clip.duration - (1 / 30)));
        }
        runtime.mixer.update(0);
        runtime.model.object.updateMatrixWorld(true);
        currentAction.current = next;
        return true;
      }

      if (currentAction.current && currentAction.current !== next) {
        currentAction.current.fadeOut(fade);
      }

      if (currentAction.current !== next) next.reset();
      next.enabled = true;
      next.setEffectiveTimeScale(timeScale);
      next.setEffectiveWeight(1);
      next.setLoop(once ? THREE.LoopOnce : THREE.LoopRepeat, once ? 1 : Infinity);
      next.clampWhenFinished = once;
      next.fadeIn(fade).play();
      currentAction.current = next;
      return true;
    } catch (error) {
      console.warn(`[ScanRig] Motion ${name} failed during blend; restoring embedded idle.`, error);
      try {
        startEmbeddedIdle();
      } catch (idleError) {
        console.warn('[ScanRig] Idle recovery failed.', idleError);
      }
      return false;
    }
  };

  useEffect(() => {
    if (!runtime) return undefined;
    if (timerRef.current) window.clearTimeout(timerRef.current);
    const motionSequence = ++motionSequenceRef.current;

    // First keep the embedded skinned idle active. Once the requested stage motion is
    // available, blend into it. This removes all visible T-pose gaps.
    if (transitionAnimation && actions[transitionAnimation]) {
      const isRun = transitionAnimation === 'running';
      const isWalk = transitionAnimation === 'walking';
      const transitionMs = transitionDurationMs ?? (isRun ? 1250 : isWalk ? 1450 : 1200);
      const timeScale = isRun ? 1.0 : isWalk ? 0.98 : 1;

      fadeTo(transitionAnimation, 0.20, false, timeScale);
      timerRef.current = window.setTimeout(() => {
        if (!mountedRef.current || motionSequence !== motionSequenceRef.current) return;
        fadeTo(animation, 0.28, animation === 'victory', 1);
      }, transitionMs);
    } else if (actions[animation]) {
      const isGreeting = animation === 'standingGreeting';
      const isVictory = animation === 'victory';
      fadeTo(animation, 0.24, isGreeting || isVictory, 1);

      // Greeting is a one-time entrance, not a permanent pose. Let the actual
      // clip play long enough to be seen, then settle into the skinned Idle.
      if (isGreeting) {
        const clipDuration = actions[animation]?.getClip?.()?.duration || 2.2;
        const greetingMs = Math.max(1800, Math.min(3200, clipDuration * 1000));
        timerRef.current = window.setTimeout(() => {
          if (!mountedRef.current || motionSequence !== motionSequenceRef.current) return;
          startEmbeddedIdle();
        }, greetingMs);
      }
    } else {
      startEmbeddedIdle();
    }

    return () => {
      motionSequenceRef.current += 1;
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, [animation, transitionAnimation, transitionKey, transitionDurationMs, actions, runtime, strictMotion]);

  useEffect(() => {
    if (poseReady) onReadyRef.current?.();
  }, [poseReady]);

  useFrame((state, delta) => {
    if (!runtime) return;

    try {
      runtime.mixer.update(delta);
      applyProceduralPose(state.clock.elapsedTime);
      runtime.model.object.updateMatrixWorld(true);
      if (!poseReady) {
        primeFrames.current += 1;
        if (primeFrames.current >= 12) setPoseReady(true);
      }
    } catch (error) {
      // A malformed optional Mixamo clip must never tear down the whole Canvas.
      // Recover in-place and remain on the safe embedded idle.
      if (!mixerFailureLogged.current) {
        console.warn('[ScanRig] Animation mixer recovered from a bad optional clip.', error);
        mixerFailureLogged.current = true;
      }
      try {
        startEmbeddedIdle();
      } catch {
        return;
      }
    }

    if (!wrapper.current) return;

    const t = state.clock.elapsedTime;
    const pointerTurn = pointerTracking ? state.pointer.x * 0.06 : 0;
    const idleTurn = Math.sin(t * 0.48) * 0.015 * motionScale;
    const tinyBob = Math.sin(t * 1.4) * 0.006 * motionScale;

    wrapper.current.rotation.y = THREE.MathUtils.damp(
      wrapper.current.rotation.y,
      rotationY + pointerTurn + idleTurn,
      4,
      delta,
    );
    const floorDemo = ['push-up','plank','crunch'].includes(proceduralExercise);
    wrapper.current.rotation.z = THREE.MathUtils.damp(wrapper.current.rotation.z, floorDemo ? -Math.PI / 2 : 0, 4.5, delta);
    wrapper.current.position.y = THREE.MathUtils.damp(
      wrapper.current.position.y,
      baseY + tinyBob,
      5,
      delta,
    );
  });

  if (!runtime) return <HologramBody accent={trainer.accent} />;

  return (
    <>
      {!poseReady && <HologramBody accent={trainer.accent} />}
      <group ref={wrapper} visible={poseReady} position={[0, baseY, 0]} rotation={[0, rotationY, 0]}>
        <group scale={runtime.model.scale}>
          <primitive object={runtime.model.object} position={runtime.model.offset} />
        </group>
        <pointLight position={[0, 1.3, 0.8]} color={trainer.accent} intensity={2.8} distance={3.4} />
      </group>
    </>
  );
}

export default function AnimatedMixamoTrainer({
  gender = 'male',
  animation = 'defaultIdle',
  transitionAnimation,
  transitionKey,
  transitionDurationMs,
  strictMotion = false,
  targetHeight = 3.0,
  targetWidth = 3.0,
  baseY = -1.0,
  rotationY = 0,
  pointerTracking = true,
  motionScale = 1,
  proceduralExercise = '',
  onReady,
}) {
  const safeGender = gender === 'female' ? 'female' : 'male';
  const trainer = TRAINER_MODELS[safeGender];
  const { source, status } = useTrainerSource(trainer.path);

  // James.fbx and Jody.fbx are now the user's WITH-SKIN idle exports.
  // Their own embedded idle clip is the canonical bootstrap pose, so the raw
  // bind/T-pose is never used as a visible fallback.
  const idleClip = useMemo(() => getEmbeddedIdleClip(source, 'defaultIdle'), [source]);
  const stagePath = TRAINER_ANIMATIONS[animation] || null;
  const stageClip = useOptionalAnimationClip(stagePath, animation || 'stage');
  const transitionPath = transitionAnimation ? TRAINER_ANIMATIONS[transitionAnimation] : null;
  const transitionClip = useOptionalAnimationClip(transitionPath, transitionAnimation || 'transition');

  if (status !== 'ready' || !source || !idleClip) {
    return <HologramBody accent={trainer.accent} failed={status === 'error'} />;
  }

  return (
    <TrainerRuntime
      source={source}
      trainer={trainer}
      animation={animation}
      transitionAnimation={transitionAnimation}
      transitionKey={transitionKey}
      transitionDurationMs={transitionDurationMs}
      strictMotion={strictMotion}
      targetHeight={targetHeight}
      targetWidth={targetWidth}
      baseY={baseY}
      rotationY={rotationY}
      pointerTracking={pointerTracking}
      motionScale={motionScale}
      onReady={onReady}
      idleClip={idleClip}
      stageClip={stageClip}
      transitionClip={transitionClip}
      proceduralExercise={proceduralExercise}
    />
  );
}
