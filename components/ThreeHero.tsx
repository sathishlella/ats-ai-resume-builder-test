'use client'

import { Canvas } from '@react-three/fiber'
import { Float, OrbitControls } from '@react-three/drei'

export default function ThreeHero() {
  return (
    // Fills the parent (parent must be `relative`)
    <div className="absolute inset-0">
      <Canvas
        camera={{ position: [0, 0, 5], fov: 50 }}
        dpr={[1, 1.5]}
        gl={{ alpha: false, antialias: true }} // NOTE: set alpha=false so the scene background is opaque
      >
        {/* Set scene background color */}
        <color attach="background" args={['#ffffff']} />

        {/* No background color = uses parent bg */}
        {/* MeshNormalMaterial doesn't need any lights and is always visible */}
        <Float speed={1.2} rotationIntensity={0.6} floatIntensity={0.8}>
          <mesh>
            <torusKnotGeometry args={[1.1, 0.35, 220, 32]} />
            <meshNormalMaterial />
          </mesh>
        </Float>

        <OrbitControls enableZoom={false} enablePan={false} />
      </Canvas>
    </div>
  )
}
