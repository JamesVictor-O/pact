"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";

export default function PactFinanceCard() {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let animationFrameId: number;
    const width = container.clientWidth;
    const height = container.clientHeight;

    // 1. Scene, Camera, Renderer
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    camera.position.set(0, 0, 8.5);

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);

    // 2. Dynamic Canvas Texture for Card Front
    const canvas = document.createElement("canvas");
    canvas.width = 1024;
    canvas.height = 640;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      // Dark metallic gradient background
      const grad = ctx.createLinearGradient(0, 0, 1024, 640);
      grad.addColorStop(0, "#121218");
      grad.addColorStop(0.5, "#1a1a24");
      grad.addColorStop(1, "#0a0a0f");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 1024, 640);

      // Subtle metallic mesh grid lines
      ctx.strokeStyle = "rgba(255, 255, 255, 0.05)";
      ctx.lineWidth = 1;
      for (let x = 0; x < 1024; x += 40) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, 640);
        ctx.stroke();
      }

      // Brand Wordmark
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 44px sans-serif";
      ctx.fillText("pact", 64, 96);

      ctx.fillStyle = "rgba(255, 255, 255, 0.6)";
      ctx.font = "24px sans-serif";
      ctx.fillText("EVENT FINANCE", 720, 96);

      // EMV Chip Graphic
      ctx.fillStyle = "#d4af37";
      ctx.roundRect(64, 160, 90, 70, 10);
      ctx.fill();

      // Card Number
      ctx.fillStyle = "#ffffff";
      ctx.font = "52px monospace";
      ctx.letterSpacing = "6px";
      ctx.fillText("1253  5432  3521  3090", 64, 380);

      // Cardholder & Exp
      ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
      ctx.font = "20px sans-serif";
      ctx.fillText("CARDHOLDER", 64, 480);
      ctx.fillText("EXP", 480, 480);

      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 26px sans-serif";
      ctx.fillText("MARVIN MCKINNEY", 64, 525);
      ctx.fillText("09/24", 480, 525);

      // Monad Logo Badge
      ctx.fillStyle = "#2d5bff";
      ctx.beginPath();
      ctx.arc(880, 510, 40, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 22px sans-serif";
      ctx.fillText("MONAD", 842, 518);
    }

    const cardTexture = new THREE.CanvasTexture(canvas);

    // 3. 3D Card Mesh Geometry & Metallic Glass Materials
    const cardShape = new THREE.Shape();
    const w = 4.2;
    const h = 2.6;
    const r = 0.25;

    cardShape.moveTo(-w / 2 + r, -h / 2);
    cardShape.lineTo(w / 2 - r, -h / 2);
    cardShape.quadraticCurveTo(w / 2, -h / 2, w / 2, -h / 2 + r);
    cardShape.lineTo(w / 2, h / 2 - r);
    cardShape.quadraticCurveTo(w / 2, h / 2, w / 2 - r, h / 2);
    cardShape.lineTo(-w / 2 + r, h / 2);
    cardShape.quadraticCurveTo(-w / 2, h / 2, -w / 2, h / 2 - r);
    cardShape.lineTo(-w / 2, -h / 2 + r);
    cardShape.quadraticCurveTo(-w / 2, -h / 2, -w / 2 + r, -h / 2);

    const extrudeSettings = {
      depth: 0.08,
      bevelEnabled: true,
      bevelSegments: 5,
      steps: 1,
      bevelSize: 0.02,
      bevelThickness: 0.02,
    };

    const cardGeometry = new THREE.ExtrudeGeometry(cardShape, extrudeSettings);
    cardGeometry.center();

    // Material setup
    const frontMaterial = new THREE.MeshStandardMaterial({
      map: cardTexture,
      roughness: 0.2,
      metalness: 0.7,
    });

    const edgeMaterial = new THREE.MeshStandardMaterial({
      color: 0x222230,
      roughness: 0.1,
      metalness: 0.9,
    });

    const cardMesh = new THREE.Mesh(cardGeometry, [frontMaterial, edgeMaterial]);
    cardMesh.castShadow = true;
    cardMesh.receiveShadow = true;
    scene.add(cardMesh);

    // 4. Floating 3D Orbiting Tokens (Monad & USDC Coins)
    const coinGroup = new THREE.Group();
    scene.add(coinGroup);

    const coinGeo = new THREE.CylinderGeometry(0.35, 0.35, 0.08, 32);
    const goldMat = new THREE.MeshStandardMaterial({
      color: 0xf8e9a8,
      metalness: 0.9,
      roughness: 0.15,
    });
    const blueMat = new THREE.MeshStandardMaterial({
      color: 0x2d5bff,
      metalness: 0.8,
      roughness: 0.2,
    });

    const coin1 = new THREE.Mesh(coinGeo, goldMat);
    coin1.position.set(-2.8, 1.4, 0.5);
    coin1.rotation.x = Math.PI / 3;
    coinGroup.add(coin1);

    const coin2 = new THREE.Mesh(coinGeo, blueMat);
    coin2.position.set(2.7, -1.2, 0.8);
    coin2.rotation.y = Math.PI / 4;
    coinGroup.add(coin2);

    // 5. Lighting Setup (Key Light, Fill Light, Rim Light for 3D specular shine)
    const ambientLight = new THREE.AmbientLight(0xffffff, 1.2);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 2.5);
    dirLight.position.set(5, 8, 5);
    dirLight.castShadow = true;
    scene.add(dirLight);

    const bluePointLight = new THREE.PointLight(0x2d5bff, 4, 15);
    bluePointLight.position.set(-4, -2, 3);
    scene.add(bluePointLight);

    const goldPointLight = new THREE.PointLight(0xf8e9a8, 3, 15);
    goldPointLight.position.set(4, 3, 2);
    scene.add(goldPointLight);

    // 6. Interactive Mouse Motion Tracking (Smooth Lerp 3D Tilt)
    let mouseX = 0;
    let mouseY = 0;
    let targetRotationX = 0;
    let targetRotationY = 0;

    const handleMouseMove = (event: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      const x = event.clientX - rect.left - rect.width / 2;
      const y = event.clientY - rect.top - rect.height / 2;
      mouseX = x / (rect.width / 2);
      mouseY = y / (rect.height / 2);
    };

    window.addEventListener("mousemove", handleMouseMove);

    // 7. Render Loop with Inertia Physics & Continuous Rotation
    let clock = new THREE.Clock();

    const animate = () => {
      const elapsedTime = clock.getElapsedTime();

      targetRotationY = mouseX * 0.45;
      targetRotationX = -mouseY * 0.35;

      // Smooth lerp for 3D card tilt
      cardMesh.rotation.y += (targetRotationY - cardMesh.rotation.y) * 0.08;
      cardMesh.rotation.x += (targetRotationX - cardMesh.rotation.x) * 0.08;

      // Floating float motion
      cardMesh.position.y = Math.sin(elapsedTime * 1.5) * 0.12;

      // Rotate 3D floating coins
      coin1.rotation.y += 0.02;
      coin1.position.y = 1.4 + Math.sin(elapsedTime * 2) * 0.15;

      coin2.rotation.x += 0.02;
      coin2.position.y = -1.2 + Math.cos(elapsedTime * 2.2) * 0.15;

      renderer.render(scene, camera);
      animationFrameId = requestAnimationFrame(animate);
    };

    animate();

    // 8. Resize Handler
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
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("resize", handleResize);
      cancelAnimationFrame(animationFrameId);
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
      renderer.dispose();
    };
  }, []);

  return <div ref={containerRef} className="webgl-3d-card-container" />;
}
