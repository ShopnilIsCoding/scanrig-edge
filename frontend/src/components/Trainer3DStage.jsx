import { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { ContactShadows } from '@react-three/drei';
import * as THREE from 'three';
import AnimatedMixamoTrainer, { TRAINER_MODELS, useTrainerAssetBundle } from './AnimatedMixamoTrainer';
import TrainerBootOverlay from './TrainerBootOverlay';
import TrainerErrorBoundary from './TrainerErrorBoundary';

const STEP_META = {
  gender: {
    label: 'TRAINER',
    value: (form) => (form.gender === 'female' ? 'JODY' : 'JAMES'),
    unit: 'PROFILE',
    accent: '#4de8d1',
    motion: 'TRAINER GREETING',
  },
  dateOfBirth: {
    label: 'AGE SCAN',
    value: (form, age) => (age ?? '--'),
    unit: 'YEARS',
    accent: '#4de8d1',
    motion: 'AGE ANALYSIS',
  },
  height: {
    label: 'HEIGHT',
    value: (form) => (form.height || '--'),
    unit: 'CM',
    accent: '#b4ff3d',
    motion: 'VERTICAL BODY SCAN',
  },
  weight: {
    label: 'WEIGHT',
    value: (form) => (form.weight || '--'),
    unit: 'KG',
    accent: '#ff8a3d',
    motion: 'WEIGHT SHIFT SCAN',
  },
  goal: {
    label: 'TARGET',
    value: (form) => (form.goal || 'SELECT'),
    unit: 'GOAL',
    accent: '#a68cff',
    motion: 'TARGET LOCK',
  },
  level: {
    label: 'LEVEL',
    value: (form) => (form.level || 'SELECT'),
    unit: 'PROFILE',
    accent: '#4de8d1',
    motion: 'READINESS CHARGE',
  },
  days: {
    label: 'SCHEDULE',
    value: (form) => (form.days?.length || 0),
    unit: 'DAYS / WEEK',
    accent: '#ff8a3d',
    motion: 'SCHEDULE REVIEW',
  },
  complete: {
    label: 'CALIBRATION',
    value: () => '100%',
    unit: 'READY',
    accent: '#b4ff3d',
    motion: 'PROFILE COMPLETE',
  },
};

const STEP_ANIMATION = {
  gender: { animation: 'standingGreeting', transition: null },
  dateOfBirth: { animation: 'thoughtfulHeadShake', transition: 'walking' },
  height: { animation: 'defaultIdle', transition: 'walking' },
  weight: { animation: 'weightShift', transition: 'walking' },
  goal: { animation: 'talking', transition: 'walking' },
  level: { animation: 'bicepCurl', transition: 'running' },
  days: { animation: 'bored', transition: 'running' },
  complete: { animation: 'victory', transition: 'running' },
};

function CameraRig() {
  const { camera, size } = useThree();

  useEffect(() => {
    const compact = size.width < 620;
    camera.position.set(0, 0.52, compact ? 7.8 : 7.15);
    camera.fov = compact ? 36 : 32;
    camera.near = 0.1;
    camera.far = 50;
    camera.lookAt(0, 0.38, 0);
    camera.updateProjectionMatrix();
  }, [camera, size.width]);

  return null;
}

function HologramPlatform({ accent, stepKey }) {
  const ring1 = useRef();
  const ring2 = useRef();
  const scan = useRef();

  useFrame((state, delta) => {
    if (ring1.current) ring1.current.rotation.z += delta * (stepKey === 'complete' ? 0.45 : 0.18);
    if (ring2.current) ring2.current.rotation.z -= delta * (stepKey === 'complete' ? 0.28 : 0.12);

    if (scan.current) {
      const t = state.clock.elapsedTime;
      scan.current.position.y = -0.72 + ((Math.sin(t * 1.1) + 1) / 2) * 3.45;
      scan.current.material.opacity = 0.09 + ((Math.sin(t * 2.2) + 1) / 2) * 0.09;
    }
  });

  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1, 0]} receiveShadow>
        <circleGeometry args={[1.5, 80]} />
        <meshStandardMaterial color="#071014" metalness={0.25} roughness={0.45} />
      </mesh>
      <mesh ref={ring1} rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.97, 0]}>
        <torusGeometry args={[1.34, 0.012, 10, 96]} />
        <meshBasicMaterial color={accent} transparent opacity={0.72} toneMapped={false} />
      </mesh>
      <mesh ref={ring2} rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.965, 0]}>
        <torusGeometry args={[1.05, 0.007, 10, 96]} />
        <meshBasicMaterial color="#4de8d1" transparent opacity={0.34} toneMapped={false} />
      </mesh>
      <mesh ref={scan} position={[0, 1, 0.08]}>
        <planeGeometry args={[2.5, 0.014]} />
        <meshBasicMaterial color={accent} transparent opacity={0.16} toneMapped={false} depthWrite={false} />
      </mesh>
    </group>
  );
}

function OrbitDots({ accent }) {
  const group = useRef();
  const dots = useMemo(() => Array.from({ length: 7 }, (_, index) => {
    const angle = (index / 7) * Math.PI * 2;
    return [Math.cos(angle) * 1.65, -0.42 + (index % 2) * 0.12, Math.sin(angle) * 1.65];
  }), []);

  useFrame((_, delta) => {
    if (group.current) group.current.rotation.y += delta * 0.36;
  });

  return (
    <group ref={group}>
      {dots.map((position, index) => (
        <mesh key={index} position={position}>
          <sphereGeometry args={[0.035, 10, 10]} />
          <meshBasicMaterial color={accent} toneMapped={false} />
        </mesh>
      ))}
    </group>
  );
}

function StepSceneEffects({ stepKey, accent }) {
  const primary = useRef();
  const secondary = useRef();

  useFrame((state, delta) => {
    const t = state.clock.elapsedTime;

    if (primary.current) {
      primary.current.rotation.z += delta * 0.35;
      const pulse = 1 + Math.sin(t * 2.1) * 0.045;
      primary.current.scale.setScalar(pulse);
    }

    if (secondary.current) {
      secondary.current.rotation.z -= delta * 0.24;
      secondary.current.position.y = Math.sin(t * 1.55) * 0.08;
    }
  });

  if (stepKey === 'dateOfBirth') {
    return (
      <group position={[0, 1.08, 0]}>
        <mesh ref={primary} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.46, 0.008, 8, 72]} />
          <meshBasicMaterial color={accent} transparent opacity={0.7} toneMapped={false} />
        </mesh>
        <mesh ref={secondary} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.62, 0.004, 8, 72]} />
          <meshBasicMaterial color="#b4ff3d" transparent opacity={0.3} toneMapped={false} />
        </mesh>
      </group>
    );
  }

  if (stepKey === 'height') {
    return (
      <group position={[1.46, 0.38, 0]}>
        <mesh>
          <boxGeometry args={[0.012, 2.85, 0.012]} />
          <meshBasicMaterial color={accent} transparent opacity={0.55} toneMapped={false} />
        </mesh>
        <mesh ref={secondary} position={[0, 0.2, 0]}>
          <boxGeometry args={[0.30, 0.018, 0.018]} />
          <meshBasicMaterial color={accent} toneMapped={false} />
        </mesh>
      </group>
    );
  }

  if (stepKey === 'weight') {
    return (
      <group position={[0, -0.91, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <mesh ref={primary}>
          <ringGeometry args={[1.42, 1.47, 80]} />
          <meshBasicMaterial color={accent} transparent opacity={0.72} side={THREE.DoubleSide} toneMapped={false} />
        </mesh>
        <mesh ref={secondary}>
          <ringGeometry args={[0.78, 0.81, 80]} />
          <meshBasicMaterial color="#4de8d1" transparent opacity={0.36} side={THREE.DoubleSide} toneMapped={false} />
        </mesh>
      </group>
    );
  }

  if (stepKey === 'goal') {
    return (
      <group position={[0, 0.45, -0.34]}>
        <mesh ref={primary}>
          <torusGeometry args={[0.8, 0.012, 8, 80]} />
          <meshBasicMaterial color={accent} transparent opacity={0.48} toneMapped={false} />
        </mesh>
        <mesh ref={secondary}>
          <torusGeometry args={[1.07, 0.006, 8, 80]} />
          <meshBasicMaterial color={accent} transparent opacity={0.22} toneMapped={false} />
        </mesh>
      </group>
    );
  }

  if (stepKey === 'level') {
    return (
      <group position={[0, 0.45, 0]}>
        <mesh ref={primary}>
          <sphereGeometry args={[1.25, 28, 18]} />
          <meshBasicMaterial color={accent} wireframe transparent opacity={0.07} toneMapped={false} />
        </mesh>
      </group>
    );
  }

  if (stepKey === 'days') {
    return <OrbitDots accent={accent} />;
  }

  if (stepKey === 'complete') {
    return (
      <group position={[0, 0.42, -0.2]}>
        <mesh ref={primary}>
          <torusGeometry args={[1.12, 0.018, 10, 96]} />
          <meshBasicMaterial color={accent} transparent opacity={0.7} toneMapped={false} />
        </mesh>
        <mesh ref={secondary}>
          <torusGeometry args={[1.42, 0.008, 10, 96]} />
          <meshBasicMaterial color="#ff8a3d" transparent opacity={0.4} toneMapped={false} />
        </mesh>
      </group>
    );
  }

  return (
    <group position={[0, 0.35, -0.25]}>
      <mesh ref={primary}>
        <torusGeometry args={[1.18, 0.008, 8, 90]} />
        <meshBasicMaterial color={accent} transparent opacity={0.22} toneMapped={false} />
      </mesh>
    </group>
  );
}

function Scene({ accent, complete, gender, stepKey, onTrainerReady }) {
  const trainerAccent = TRAINER_MODELS[gender]?.accent || accent;
  const animation = STEP_ANIMATION[stepKey] || STEP_ANIMATION.gender;

  return (
    <>
      <CameraRig />
      <color attach="background" args={['#081014']} />
      <fog attach="fog" args={['#081014', 7.2, 11]} />
      <ambientLight intensity={0.82} />
      <hemisphereLight args={['#85fff1', '#050709', 0.95]} />
      <spotLight position={[-3, 5, 4]} angle={0.42} penumbra={0.8} intensity={50} color="#5cebd8" castShadow />
      <spotLight position={[4, 3, 3]} angle={0.5} penumbra={0.8} intensity={38} color="#ff8a3d" />
      <pointLight position={[0, 2, 2.5]} intensity={10} color={trainerAccent} />

      <HologramPlatform accent={trainerAccent} stepKey={stepKey} />
      <StepSceneEffects key={stepKey} stepKey={stepKey} accent={accent} />

      <AnimatedMixamoTrainer
        key={gender}
        gender={gender}
        animation={animation.animation}
        transitionAnimation={animation.transition}
        transitionDurationMs={animation.transitionDurationMs}
        transitionKey={stepKey}
        strictMotion
        targetHeight={3.06}
        targetWidth={3.12}
        baseY={-1}
        onReady={onTrainerReady}
      />

      <ContactShadows position={[0, -0.98, 0]} opacity={0.52} scale={5.5} blur={2.6} far={3.6} />
    </>
  );
}

export default function Trainer3DStage({ stepKey, form, age, stepIndex, totalSteps }) {
  const meta = STEP_META[stepKey] || STEP_META.dateOfBirth;
  const value = meta.value(form, age);
  const complete = stepKey === 'complete';
  const progress = Math.round(((stepIndex + 1) / totalSteps) * 100);
  const status = useMemo(() => complete ? 'PROFILE READY' : 'LIVE CALIBRATION', [complete]);
  const gender = form.gender === 'female' ? 'female' : 'male';
  const trainer = TRAINER_MODELS[gender];
  const trainerAssets = useTrainerAssetBundle();
  const [runtimeReadyKey, setRuntimeReadyKey] = useState(null);
  const trainerRuntimeKey = `trainer:${gender}`;
  const runtimeReady = runtimeReadyKey === trainerRuntimeKey;

  return (
    <div className="relative min-h-[700px] overflow-hidden bg-[#071014] lg:min-h-[700px] max-[760px]:min-h-[540px]">
      <div className="pointer-events-none absolute inset-0 z-[1] bg-[linear-gradient(rgba(77,232,209,.045)_1px,transparent_1px),linear-gradient(90deg,rgba(77,232,209,.045)_1px,transparent_1px)] bg-[size:34px_34px] [mask-image:linear-gradient(to_bottom,#000_0%,transparent_76%)]" />
      <div className="pointer-events-none absolute inset-x-[12%] top-0 z-[2] h-32 bg-[radial-gradient(ellipse_at_top,rgba(77,232,209,.15),transparent_68%)]" />

      <div className="absolute inset-0 z-0">
        <TrainerErrorBoundary resetKey={`${gender}-${stepKey}`}>
          {trainerAssets.status === 'ready' && (
            <Canvas
              camera={{ position: [0, 0.52, 7.15], fov: 32 }}
              dpr={[1, 1.6]}
              shadows
              gl={{ antialias: true, alpha: false, powerPreference: 'high-performance' }}
            >
              <Scene
                accent={meta.accent}
                complete={complete}
                gender={gender}
                stepKey={stepKey}
                onTrainerReady={() => setRuntimeReadyKey(trainerRuntimeKey)}
              />
            </Canvas>
          )}
        </TrainerErrorBoundary>
      </div>

      <TrainerBootOverlay
        show={trainerAssets.status !== 'ready' || !runtimeReady}
        progress={trainerAssets.progress}
        runtimeReady={runtimeReady}
        error={trainerAssets.status === 'error'}
        label="WARMING UP YOUR COACH"
      />

      <div className="pointer-events-none absolute left-6 top-6 z-10 max-[760px]:left-4 max-[760px]:top-4">
        <div className="font-mono text-[10px] font-semibold tracking-[.18em] text-[#4de8d1]">SCANRIG // BODY LAB</div>
        <div className="mt-2 flex items-center gap-2 text-[11px] font-semibold tracking-[.08em] text-white/65">
          <span className="h-2 w-2 rounded-full bg-[#b4ff3d] shadow-[0_0_16px_#b4ff3d]" />
          {status}
        </div>
        <div className="mt-2 font-mono text-[8px] tracking-[.13em] text-white/30">
          {`${trainer.name.toUpperCase()} // ${gender.toUpperCase()} TRAINER`}
        </div>
      </div>

      <div className="pointer-events-none absolute right-6 top-6 z-10 rounded-2xl border border-white/10 bg-black/30 px-4 py-3 backdrop-blur-xl max-[760px]:right-4 max-[760px]:top-4">
        <div className="font-mono text-[8px] tracking-[.14em] text-white/35">CALIBRATION</div>
        <div className="mt-1 font-mono text-sm font-bold text-[#b4ff3d]">{progress}%</div>
      </div>

      <div className="pointer-events-none absolute left-6 top-1/2 z-10 w-[180px] -translate-y-1/2 rounded-2xl border border-white/10 bg-[#0a1116]/75 p-4 shadow-2xl backdrop-blur-xl max-[760px]:left-3 max-[760px]:top-[39%] max-[760px]:w-[145px] max-[760px]:p-3">
        <div className="font-mono text-[8px] tracking-[.14em] text-white/35">{meta.label}</div>
        <div className="mt-2 break-words text-[clamp(1.5rem,3vw,2.2rem)] font-black leading-none" style={{ color: trainer.accent }}>{value}</div>
        <div className="mt-2 font-mono text-[8px] tracking-[.12em] text-white/40">{meta.unit}</div>
      </div>

      <div className="pointer-events-none absolute bottom-24 right-6 z-10 w-[190px] rounded-2xl border border-white/10 bg-[#0a1116]/75 p-4 backdrop-blur-xl max-[760px]:bottom-20 max-[760px]:right-3 max-[760px]:w-[154px] max-[760px]:p-3">
        <div className="font-mono text-[8px] tracking-[.14em] text-white/35">STAGE MOTION</div>
        <div className="mt-2 flex items-center gap-2 font-mono text-[10px] font-bold" style={{ color: meta.accent }}>
          <span className="h-2 w-2 rounded-full" style={{ background: meta.accent, boxShadow: `0 0 12px ${meta.accent}` }} />
          {meta.motion}
        </div>
        <div className="mt-2 font-mono text-[7px] leading-4 text-white/35">Your coach changes movement for each profile step while the scan display follows the current check.</div>
      </div>

      <div className="pointer-events-none absolute bottom-6 left-1/2 z-10 flex -translate-x-1/2 items-center gap-2 rounded-full border border-white/10 bg-black/35 px-4 py-2 backdrop-blur-xl">
        {Array.from({ length: totalSteps }, (_, index) => (
          <span
            key={index}
            className={`h-1.5 rounded-full transition-all duration-300 ${index === stepIndex ? 'w-8 bg-[#ff8a3d]' : index < stepIndex ? 'w-3 bg-[#b4ff3d]' : 'w-3 bg-white/20'}`}
          />
        ))}
      </div>
    </div>
  );
}

