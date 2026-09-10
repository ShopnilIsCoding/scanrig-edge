import { useEffect, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { ContactShadows } from '@react-three/drei';
import { motion } from 'motion/react';
import * as THREE from 'three';
import AnimatedMixamoTrainer, { useTrainerAssetBundle } from './AnimatedMixamoTrainer';
import TrainerBootOverlay from './TrainerBootOverlay';
import TrainerErrorBoundary from './TrainerErrorBoundary';

function CameraSetup({ variant }) {
  const { camera, size } = useThree();

  useEffect(() => {
    if (variant === 'journey') {
      camera.position.set(0, 0.6, 7.6);
      camera.fov = 30;
      camera.lookAt(0, 0.4, 0);
    } else {
      const compact = size.width < 520;
      camera.position.set(0, 0.58, compact ? 7.8 : 7.15);
      camera.fov = compact ? 36 : 31;
      camera.lookAt(0, 0.42, 0);
    }
    camera.updateProjectionMatrix();
  }, [camera, size.width, variant]);

  return null;
}

function ShowcaseRings({ compact = false }) {
  const a = useRef();
  const b = useRef();

  useFrame((state, delta) => {
    if (a.current) a.current.rotation.z += delta * 0.2;
    if (b.current) b.current.rotation.z -= delta * 0.12;
    const pulse = 1 + Math.sin(state.clock.elapsedTime * 1.8) * 0.025;
    if (a.current) a.current.scale.setScalar(pulse);
  });

  const radius = compact ? 1.05 : 1.38;
  return (
    <group position={[0, -0.98, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <mesh>
        <circleGeometry args={[radius + 0.16, 72]} />
        <meshStandardMaterial color="#061014" metalness={0.25} roughness={0.55} />
      </mesh>
      <mesh ref={a} position={[0, 0, 0.01]}>
        <torusGeometry args={[radius, 0.012, 10, 88]} />
        <meshBasicMaterial color="#4de8d1" transparent opacity={0.76} toneMapped={false} />
      </mesh>
      <mesh ref={b} position={[0, 0, 0.012]}>
        <torusGeometry args={[radius * 0.73, 0.007, 10, 88]} />
        <meshBasicMaterial color="#b4ff3d" transparent opacity={0.38} toneMapped={false} />
      </mesh>
    </group>
  );
}

function ShowcaseScene({ animation, variant, rotationY = 0, onTrainerReady, gender = 'male', proceduralExercise = '' }) {
  const compact = variant === 'journey';

  return (
    <>
      <CameraSetup variant={variant} />
      <ambientLight intensity={0.8} />
      <hemisphereLight args={['#7fffee', '#050709', 0.95]} />
      <spotLight position={[-3, 5, 4]} angle={0.45} penumbra={0.8} intensity={46} color="#4de8d1" />
      <spotLight position={[3.6, 3.2, 3.2]} angle={0.5} penumbra={0.8} intensity={30} color="#ff8a3d" />
      <ShowcaseRings compact={compact} />
      <AnimatedMixamoTrainer
        gender={gender}
        animation={animation}
        transitionKey={`${variant}-${animation}`}
        targetHeight={compact ? 2.75 : 3.28}
        targetWidth={compact ? 2.65 : 3.36}
        baseY={-1}
        pointerTracking={!compact}
        motionScale={compact ? 0.5 : 1}
        rotationY={rotationY}
        onReady={onTrainerReady}
        proceduralExercise={proceduralExercise}
      />
      <ContactShadows position={[0, -0.98, 0]} opacity={0.48} scale={compact ? 4 : 5.4} blur={2.7} far={3.2} />
    </>
  );
}

function DormantShowcase({ compact = false }) {
  return (
    <div className="absolute inset-0 grid place-items-center bg-[radial-gradient(circle_at_center,rgba(77,232,209,.07),transparent_58%)]">
      <div className={`relative ${compact ? 'h-24 w-24' : 'h-40 w-40'}`}>
        <motion.div
          className="absolute inset-0 rounded-full border border-[#4de8d1]/20"
          animate={{ rotate: 360 }}
          transition={{ duration: 12, repeat: Infinity, ease: 'linear' }}
        />
        <motion.div
          className="absolute inset-[22%] rounded-full border border-[#b4ff3d]/15"
          animate={{ scale: [0.92, 1.04, 0.92], opacity: [0.25, 0.5, 0.25] }}
          transition={{ duration: 2, repeat: Infinity }}
        />
      </div>
    </div>
  );
}

export default function TrainerShowcase3D({ animation = 'defaultIdle', variant = 'hero', className = '', rotationY = 0, gender = 'male', proceduralExercise = '' }) {
  const compact = variant === 'journey';
  const trainerAssets = useTrainerAssetBundle();
  const hostRef = useRef(null);
  const visibleRef = useRef(variant === 'hero');
  const [visible, setVisible] = useState(variant === 'hero');
  const [mountId, setMountId] = useState(0);
  const [runtimeReady, setRuntimeReady] = useState(false);

  useEffect(() => {
    setRuntimeReady(false);
  }, [mountId]);

  useEffect(() => {
    const node = hostRef.current;
    if (!node || typeof IntersectionObserver === 'undefined') {
      setVisible(true);
      return undefined;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        const nextVisible = entry.isIntersecting && entry.intersectionRatio > 0.08;
        if (nextVisible === visibleRef.current) return;
        if (!visibleRef.current && nextVisible) setMountId((id) => id + 1);
        visibleRef.current = nextVisible;
        setVisible(nextVisible);
      },
      { threshold: [0, 0.08, 0.2] },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={hostRef} className={`relative h-full w-full overflow-hidden ${className}`}>
      {visible && trainerAssets.status === 'ready' ? (
        <TrainerErrorBoundary resetKey={`${variant}-${animation}-${gender}-${proceduralExercise}-${mountId}`}>
          <Canvas
            key={mountId}
            camera={{ position: [0, 0.58, 7.15], fov: 31 }}
            dpr={compact ? [1, 1.12] : [1, 1.3]}
            gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
            shadows={!compact}
          >
            <ShowcaseScene
              animation={animation}
              variant={variant}
              rotationY={rotationY}
              onTrainerReady={() => setRuntimeReady(true)}
              gender={gender}
              proceduralExercise={proceduralExercise}
            />
          </Canvas>
        </TrainerErrorBoundary>
      ) : (
        <DormantShowcase compact={compact} />
      )}

      {visible && (
        <TrainerBootOverlay
          compact={compact}
          show={trainerAssets.status !== 'ready' || !runtimeReady}
          progress={trainerAssets.progress}
          runtimeReady={runtimeReady}
          error={trainerAssets.status === 'error'}
          label={compact ? 'WARMING UP COACH' : `WARMING UP ${gender === 'female' ? 'JODY' : 'JAMES'}`}
        />
      )}
    </div>
  );
}
