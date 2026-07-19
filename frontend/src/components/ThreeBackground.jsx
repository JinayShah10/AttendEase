import { useEffect, useRef } from 'react';
import * as THREE from 'three';

const DARK  = { primary: 0x60a5fa, secondary: 0xa78bfa, accent: 0x22d3ee, bg: '#0a192f' };
const LIGHT = { primary: 0x2563eb, secondary: 0x7c3aed, accent: 0x0284c7, bg: '#eef2ff' };

export default function ThreeBackground({ dark }) {
  const mountRef  = useRef(null);
  const stateRef  = useRef(null);

  // build scene once
  useEffect(() => {
    const el = mountRef.current;
    if (!el) return;

    // ALWAYS use window dims - avoids 0-size on first mount
    const W = window.innerWidth;
    const H = window.innerHeight;

    const scene    = new THREE.Scene();
    const camera   = new THREE.PerspectiveCamera(70, W / H, 0.1, 200);
    camera.position.z = 8;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(W, H);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 0);
    el.appendChild(renderer.domElement);

    // Materials registry (for recoloring)
    const matRegistry = []; // { mat, colorKey }

    const mkMat = (colorKey, op) => {
      const C = dark ? DARK : LIGHT;
      const mat = new THREE.MeshBasicMaterial({
        color: C[colorKey],
        wireframe: true,
        transparent: true,
        opacity: op,
      });
      matRegistry.push({ mat, colorKey });
      return mat;
    };

    // 24 floating wireframe shapes spread across whole viewport
    const shapeDefs = [
      { G: () => new THREE.IcosahedronGeometry(1.5, 0),    c: 'primary',   op: 0.70 },
      { G: () => new THREE.OctahedronGeometry(1.3, 0),     c: 'secondary', op: 0.65 },
      { G: () => new THREE.TetrahedronGeometry(1.4, 0),    c: 'accent',    op: 0.65 },
      { G: () => new THREE.IcosahedronGeometry(1.0, 0),    c: 'secondary', op: 0.60 },
      { G: () => new THREE.OctahedronGeometry(0.9, 0),     c: 'accent',    op: 0.60 },
      { G: () => new THREE.TorusGeometry(0.9,0.15,8,20),   c: 'primary',   op: 0.60 },
      { G: () => new THREE.IcosahedronGeometry(0.8, 0),    c: 'accent',    op: 0.55 },
      { G: () => new THREE.TetrahedronGeometry(0.8, 0),    c: 'primary',   op: 0.55 },
      { G: () => new THREE.OctahedronGeometry(1.1, 0),     c: 'secondary', op: 0.55 },
      { G: () => new THREE.TorusGeometry(0.7,0.12,6,18),   c: 'secondary', op: 0.50 },
      { G: () => new THREE.IcosahedronGeometry(1.2, 0),    c: 'primary',   op: 0.50 },
      { G: () => new THREE.OctahedronGeometry(0.7, 0),     c: 'accent',    op: 0.50 },
      { G: () => new THREE.TetrahedronGeometry(1.1, 0),    c: 'secondary', op: 0.45 },
      { G: () => new THREE.IcosahedronGeometry(0.6, 0),    c: 'accent',    op: 0.45 },
      { G: () => new THREE.TorusGeometry(1.1,0.18,8,24),   c: 'primary',   op: 0.45 },
      { G: () => new THREE.OctahedronGeometry(0.5, 0),     c: 'secondary', op: 0.40 },
      { G: () => new THREE.IcosahedronGeometry(1.4, 0),    c: 'primary',   op: 0.40 },
      { G: () => new THREE.OctahedronGeometry(1.2, 0),     c: 'accent',    op: 0.40 },
      { G: () => new THREE.TetrahedronGeometry(1.3, 0),    c: 'secondary', op: 0.35 },
      { G: () => new THREE.IcosahedronGeometry(0.9, 0),    c: 'primary',   op: 0.35 },
      { G: () => new THREE.TorusGeometry(0.8, 0.1, 5, 15), c: 'accent',    op: 0.30 },
      { G: () => new THREE.OctahedronGeometry(0.6, 0),     c: 'secondary', op: 0.30 },
    ];

    const rand = (a, b) => Math.random() * (b - a) + a;

    const meshData = shapeDefs.map(({ G, c, op }) => {
      const geo  = G();
      const mat  = mkMat(c, op);
      const mesh = new THREE.Mesh(geo, mat);

      mesh.position.set(rand(-14, 14), rand(-10, 10), rand(-12, 1));
      mesh.rotation.set(rand(0, Math.PI * 2), rand(0, Math.PI * 2), rand(0, Math.PI * 2));
      scene.add(mesh);

      return {
        mesh,
        vx: rand(-0.03, 0.03),
        vy: rand(-0.025, 0.025),
        vz: rand(-0.015, 0.015),
        rx: rand(-0.015, 0.015),
        ry: rand(-0.02, 0.02),
        rz: rand(-0.012, 0.012),
      };
    });

    // Particle system - 900 independently moving dots
    const N   = 900;
    const pos = new Float32Array(N * 3);
    const vel = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      pos[i*3]   = rand(-16, 16);
      pos[i*3+1] = rand(-12, 12);
      pos[i*3+2] = rand(-15, 5);
      vel[i*3]   = rand(-0.015, 0.015);
      vel[i*3+1] = rand(-0.012, 0.012);
      vel[i*3+2] = rand(-0.008, 0.008);
    }
    const pGeo = new THREE.BufferGeometry();
    pGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const pMat = new THREE.PointsMaterial({
      color: dark ? DARK.primary : LIGHT.primary,
      size: 0.07,
      transparent: true,
      opacity: dark ? 0.85 : 0.65,
    });
    matRegistry.push({ mat: pMat, colorKey: 'primary' });
    const pts = new THREE.Points(pGeo, pMat);
    scene.add(pts);

    // Store for dark-mode recoloring
    stateRef.current = { matRegistry, pMat };

    // Animation loop
    let rafId;
    const tick = () => {
      rafId = requestAnimationFrame(tick);

      // Move + rotate each shape, bounce at screen limits
      meshData.forEach((d, i) => {
        d.mesh.position.x += d.vx;
        d.mesh.position.y += d.vy;
        d.mesh.position.z += d.vz;
        d.mesh.rotation.x += d.rx;
        d.mesh.rotation.y += d.ry;
        d.mesh.rotation.z += d.rz;
        if (Math.abs(d.mesh.position.x) > 15) meshData[i].vx *= -1;
        if (Math.abs(d.mesh.position.y) > 11) meshData[i].vy *= -1;
        if (d.mesh.position.z > 2 || d.mesh.position.z < -15) meshData[i].vz *= -1;
      });

      // Move particles, bounce at limits
      const p = pGeo.attributes.position.array;
      for (let i = 0; i < N; i++) {
        p[i*3]   += vel[i*3];
        p[i*3+1] += vel[i*3+1];
        p[i*3+2] += vel[i*3+2];
        if (Math.abs(p[i*3])   > 16) vel[i*3]   *= -1;
        if (Math.abs(p[i*3+1]) > 12) vel[i*3+1] *= -1;
        if (p[i*3+2] > 5 || p[i*3+2] < -15) vel[i*3+2] *= -1;
      }
      pGeo.attributes.position.needsUpdate = true;

      renderer.render(scene, camera);
    };
    tick();

    // Resize
    const onResize = () => {
      const nW = window.innerWidth, nH = window.innerHeight;
      camera.aspect = nW / nH;
      camera.updateProjectionMatrix();
      renderer.setSize(nW, nH);
    };
    window.addEventListener('resize', onResize);

    return () => {
      window.removeEventListener('resize', onResize);
      cancelAnimationFrame(rafId);
      matRegistry.forEach(({ mat }) => mat.dispose());
      pGeo.dispose();
      renderer.dispose();
      if (el.contains(renderer.domElement)) el.removeChild(renderer.domElement);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // scene only built once

  // recolor on dark-mode toggle (no rebuild)
  useEffect(() => {
    const s = stateRef.current;
    if (!s) return;
    const C = dark ? DARK : LIGHT;
    s.matRegistry.forEach(({ mat, colorKey }) => {
      mat.color.set(C[colorKey]);
      if (mat.isPointsMaterial) mat.opacity = dark ? 0.85 : 0.65;
    });
  }, [dark]);

  return (
    <div
      ref={mountRef}
      style={{ 
        position: 'fixed', 
        inset: 0, 
        zIndex: -1, 
        width: '100vw', 
        height: '100vh',
        backgroundColor: dark ? DARK.bg : LIGHT.bg,
        transition: 'background-color 0.4s ease'
      }}
    />
  );
}
