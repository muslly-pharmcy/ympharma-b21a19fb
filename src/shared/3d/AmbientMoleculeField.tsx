import { useEffect, useMemo, useRef } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'

/**
 * Lightweight ambient molecule field.
 * - instanced spheres, no postprocessing
 * - DPR capped, particle count scales with viewport
 * - reacts to pointer / touch drag via smooth parallax
 */

function Molecules({ count }: { count: number }) {
  const groupRef = useRef<THREE.Group>(null)
  const pointsRef = useRef<THREE.InstancedMesh>(null)
  const { viewport } = useThree()

  const seeds = useMemo(() => {
    const arr: { pos: THREE.Vector3; speed: number; phase: number; scale: number }[] = []
    for (let i = 0; i < count; i++) {
      arr.push({
        pos: new THREE.Vector3(
          (Math.random() - 0.5) * 12,
          (Math.random() - 0.5) * 7,
          (Math.random() - 0.5) * 5,
        ),
        speed: 0.15 + Math.random() * 0.35,
        phase: Math.random() * Math.PI * 2,
        scale: 0.035 + Math.random() * 0.075,
      })
    }
    return arr
  }, [count])

  const dummy = useMemo(() => new THREE.Object3D(), [])
  const target = useRef({ x: 0, y: 0 })

  // canvas is pointer-events:none, so track the pointer on window instead
  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      target.current.x = (e.clientX / window.innerWidth - 0.5) * 0.56
      target.current.y = (e.clientY / window.innerHeight - 0.5) * 0.36
    }
    window.addEventListener('pointermove', onMove, { passive: true })
    return () => window.removeEventListener('pointermove', onMove)
  }, [])

  useFrame((state, delta) => {
    const t = state.clock.elapsedTime
    const mesh = pointsRef.current
    if (mesh) {
      for (let i = 0; i < seeds.length; i++) {
        const s = seeds[i]!
        dummy.position.set(
          s.pos.x + Math.sin(t * s.speed + s.phase) * 0.4,
          s.pos.y + Math.cos(t * s.speed * 0.8 + s.phase) * 0.5,
          s.pos.z,
        )
        const pulse = 1 + Math.sin(t * 1.4 + s.phase) * 0.18
        dummy.scale.setScalar(s.scale * pulse)
        dummy.updateMatrix()
        mesh.setMatrixAt(i, dummy.matrix)
      }
      mesh.instanceMatrix.needsUpdate = true
    }

    const g = groupRef.current
    if (g) {
      const k = Math.min(1, delta * 2.2)
      g.rotation.y += (target.current.x - g.rotation.y) * k
      g.rotation.x += (-target.current.y - g.rotation.x) * k
    }
  })

  const scale = Math.min(1, viewport.width / 10)

  return (
    <group ref={groupRef} scale={scale}>
      <instancedMesh ref={pointsRef} args={[undefined, undefined, count]} frustumCulled={false}>
        <sphereGeometry args={[1, 12, 12]} />
        <meshBasicMaterial color="#0F766E" transparent opacity={0.5} />
      </instancedMesh>
      <mesh position={[2.6, 1.1, -1.5]}>
        <sphereGeometry args={[0.14, 16, 16]} />
        <meshBasicMaterial color="#C9A227" transparent opacity={0.35} />
      </mesh>
      <mesh position={[-3.1, -1.4, -1]}>
        <sphereGeometry args={[0.1, 16, 16]} />
        <meshBasicMaterial color="#005D4F" transparent opacity={0.4} />
      </mesh>
    </group>
  )
}

export default function AmbientMoleculeField() {
  const count = typeof window !== 'undefined' && window.innerWidth < 640 ? 26 : 60

  return (
    <Canvas
      dpr={[1, 1.6]}
      gl={{ antialias: false, alpha: true, powerPreference: 'low-power' }}
      camera={{ position: [0, 0, 8], fov: 50 }}
      style={{ pointerEvents: 'none' }}
      aria-hidden
    >
      <Molecules count={count} />
    </Canvas>
  )
}
