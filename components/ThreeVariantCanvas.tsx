'use client'

import { Canvas } from '@react-three/fiber'
import {
  Float,
  Environment,
  OrbitControls,
  useMatcapTexture,
} from '@react-three/drei'
import * as THREE from 'three'
import { memo } from 'react'

export type Variant =
  | 'chrome-orb'
  | 'glass-crystal'
  | 'toon-blob'
  | 'wireframe-ico'
  | 'neon-ring'
  | 'car-paint'
  | 'dual-layer'
  | 'point-cloud'
  | 'ribbon'
  | 'torus' // simple torus, not the link

function ChromeOrb() {
  return (
    <mesh>
      <sphereGeometry args={[1.2, 64, 64]} />
      <meshStandardMaterial metalness={1} roughness={0.05} />
    </mesh>
  )
}

function GlassCrystal() {
  return (
    <mesh>
      <icosahedronGeometry args={[1.1, 2]} />
      <meshPhysicalMaterial
        transmission={1}
        thickness={0.6}
        roughness={0.35}
        ior={1.3}
        envMapIntensity={1}
      />
    </mesh>
  )
}

function ToonBlob() {
  return (
    <mesh>
      <sphereGeometry args={[1.2, 64, 64]} />
      <meshToonMaterial color="#9fb3ff" />
    </mesh>
  )
}

function WireIco() {
  return (
    <mesh>
      <icosahedronGeometry args={[1.2, 2]} />
      <meshStandardMaterial
        color="#00e5ff"
        wireframe
        opacity={0.7}
        transparent
      />
    </mesh>
  )
}

function NeonRing() {
  return (
    <mesh>
      <torusGeometry args={[1.0, 0.05, 16, 160]} />
      <meshBasicMaterial color="#7c3aed" />
    </mesh>
  )
}

function CarPaint() {
  return (
    <mesh>
      <sphereGeometry args={[1.15, 64, 64]} />
      <meshPhysicalMaterial
        color="#4451ff"
        metalness={0.3}
        roughness={0.25}
        clearcoat={1}
        clearcoatRoughness={0.05}
      />
    </mesh>
  )
}

function DualLayer() {
  return (
    <group>
      <mesh>
        <sphereGeometry args={[0.75, 48, 48]} />
        <meshStandardMaterial metalness={1} roughness={0.1} />
      </mesh>
      <mesh>
        <sphereGeometry args={[1.1, 64, 64]} />
        <meshPhysicalMaterial transmission={1} thickness={0.5} roughness={0.2} />
      </mesh>
    </group>
  )
}

function PointCloud() {
  return (
    <points>
      <sphereGeometry args={[1.0, 64, 64]} />
      <pointsMaterial size={0.02} color="#9ca3af" />
    </points>
  )
}

function Ribbon() {
  const path = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.8, 0, 0.2),
    new THREE.Vector3(0, 0.6, 0),
    new THREE.Vector3(0.8, 0, -0.2),
  ])
  return (
    <mesh>
      <tubeGeometry args={[path, 100, 0.08, 16, false]} />
      <meshStandardMaterial metalness={0.8} roughness={0.2} />
    </mesh>
  )
}

function Torus() {
  return (
    <mesh>
      <torusGeometry args={[1.1, 0.3, 48, 96]} />
      <meshStandardMaterial metalness={0.7} roughness={0.2} />
    </mesh>
  )
}

function VariantMesh({ variant }: { variant: Variant }) {
  switch (variant) {
    case 'chrome-orb':
      return <ChromeOrb />
    case 'glass-crystal':
      return <GlassCrystal />
    case 'toon-blob':
      return <ToonBlob />
    case 'wireframe-ico':
      return <WireIco />
    case 'neon-ring':
      return <NeonRing />
    case 'car-paint':
      return <CarPaint />
    case 'dual-layer':
      return <DualLayer />
    case 'point-cloud':
      return <PointCloud />
    case 'ribbon':
      return <Ribbon />
    case 'torus':
    default:
      return <Torus />
  }
}

function Scene({ variant }: { variant: Variant }) {
  return (
    <>
      <color attach="background" args={['#ffffff']} />
      <ambientLight intensity={0.4} />
      <directionalLight position={[5, 5, 5]} intensity={1.2} />
      <Float speed={1.2} rotationIntensity={0.6} floatIntensity={0.8}>
        <VariantMesh variant={variant} />
      </Float>
      <Environment preset="city" />
      <OrbitControls enableZoom={false} />
    </>
  )
}

export default memo(function ThreeVariantCanvas({
  variant,
}: {
  variant: Variant
}) {
  return (
    <Canvas camera={{ position: [2.5, 2.5, 2.5], fov: 55 }} dpr={[1, 1.5]}>
      <Scene variant={variant} />
    </Canvas>
  )
})
