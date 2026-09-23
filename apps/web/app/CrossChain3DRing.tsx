"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";

export default function CrossChain3DRing() {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let animationFrameId: number;
    const width = container.clientWidth;
    const height = container.clientHeight;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    camera.position.set(0, 0, 7);

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);

    // Dynamic 3D Ribbon Ring with Chain Badges
    const ringGroup = new THREE.Group();
    scene.add(ringGroup);

    // Torus Geometry for 3D Ring
    const ringGeo = new THREE.TorusGeometry(2.4, 0.35, 32, 100);
    const ringMat = new THREE.MeshStandardMaterial({
      color: 0x16161a,
      metalness: 0.85,
      roughness: 0.2,
      wireframe: false,
    });
    const ringMesh = new THREE.Mesh(ringGeo, ringMat);
    ringGroup.add(ringMesh);

    // Floating 3D Chain Nodes around the ring
    const chainTokens = [
      { name: "MONAD", color: 0x2d5bff, angle: 0 },
      { name: "BASE", color: 0x0052ff, angle: Math.PI / 2 },
      { name: "ETH", color: 0x627eea, angle: Math.PI },
      { name: "SOL", color: 0x14f195, angle: (Math.PI * 3) / 2 },
    ];

    const nodeGroup = new THREE.Group();
    ringGroup.add(nodeGroup);

    chainTokens.forEach((t) => {
      const geo = new THREE.SphereGeometry(0.38, 32, 32);
      const mat = new THREE.MeshStandardMaterial({
        color: t.color,
        metalness: 0.8,
        roughness: 0.2,
      });
      const sphere = new THREE.Mesh(geo, mat);
      const radius = 2.4;
      sphere.position.x = radius * Math.cos(t.angle);
      sphere.position.y = radius * Math.sin(t.angle);
      sphere.position.z = 0;
      nodeGroup.add(sphere);
    });

    // Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 1.4);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 2.5);
    dirLight.position.set(4, 6, 5);
    scene.add(dirLight);

    const pointLight = new THREE.PointLight(0x2d5bff, 3, 10);
    pointLight.position.set(-3, -2, 4);
    scene.add(pointLight);

    // Tilt the 3D ring like Comacard's flag ring
    ringGroup.rotation.x = Math.PI / 3.5;
    ringGroup.rotation.y = -Math.PI / 6;

    let clock = new THREE.Clock();

    const animate = () => {
      const elapsedTime = clock.getElapsedTime();
      ringGroup.rotation.z = elapsedTime * 0.4;
      renderer.render(scene, camera);
      animationFrameId = requestAnimationFrame(animate);
    };

    animate();

    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };

    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      cancelAnimationFrame(animationFrameId);
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
      renderer.dispose();
    };
  }, []);

  return <div ref={containerRef} className="webgl-3d-ring-container" />;
}
