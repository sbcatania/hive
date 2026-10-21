"use client";

import { Canvas, type ThreeEvent } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { BUG_ART, paintColor } from "@/lib/bug-art";
import { TILE } from "@/lib/themes";
import type { BugLetter, ColorCode, MoveView } from "@/lib/engine-types";
import type { BoardProps } from "./board-types";

const R = 1;
const H = 0.34;
const SQ3 = Math.sqrt(3);
const pos = (q: number, r: number) => [R * SQ3 * (q + r / 2), R * 1.5 * r] as const;

const textureCache = new Map<string, THREE.Texture>();

function faceTexture(bug: BugLetter, color: ColorCode) {
  const key = bug + color;
  const hit = textureCache.get(key);
  if (hit) return hit;
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const t = TILE[color];
  const g = ctx.createLinearGradient(0, 0, size * 0.4, size);
  g.addColorStop(0, t.gradient[0]);
  g.addColorStop(1, t.gradient[1]);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  // The cylinder cap maps the texture so that +z (screen "down") is canvas up,
  // so draw the bug flipped vertically.
  ctx.translate(0, size);
  ctx.scale(1, -1);
  const glyph = size * 0.62;
  ctx.translate((size - glyph) / 2, (size - glyph) / 2);
  ctx.scale(glyph / 100, glyph / 100);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  for (const s of BUG_ART[bug]) {
    const path = new Path2D(s.d);
    ctx.globalAlpha = s.opacity ?? 1;
    if (s.fill !== "none") {
      ctx.fillStyle = paintColor(s.fill, bug, t.ink);
      ctx.fill(path);
    }
    if (s.stroke && s.stroke !== "none") {
      ctx.strokeStyle = paintColor(s.stroke, bug, t.ink);
      ctx.lineWidth = s.width ?? 1;
      ctx.stroke(path);
    }
  }
  ctx.globalAlpha = 1;
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  // Cylinder caps map the texture with +u pointing along -x; turn it so the bug faces "up" (-z).
  tex.center.set(0.5, 0.5);
  tex.rotation = -Math.PI / 2;
  tex.anisotropy = 4;
  textureCache.set(key, tex);
  return tex;
}

const prism = new THREE.CylinderGeometry(R * 0.95, R * 0.95, H, 6);
const disc = new THREE.CylinderGeometry(R * 0.9, R * 0.9, 0.04, 6);
const ring = new THREE.RingGeometry(R * 0.86, R * 1.0, 6, 1, Math.PI / 6);

function Piece({ bug, color, q, r, level, onClick }: { bug: BugLetter; color: ColorCode; q: number; r: number; level: number; onClick?: (e: ThreeEvent<MouseEvent>) => void }) {
  const materials = useMemo(() => {
    const t = TILE[color];
    const side = new THREE.MeshStandardMaterial({ color: t.side, roughness: 0.55 });
    const top = new THREE.MeshStandardMaterial({ map: faceTexture(bug, color), roughness: 0.45 });
    return [side, top, side];
  }, [bug, color]);
  const [x, z] = pos(q, r);
  return (
    <mesh geometry={prism} material={materials} position={[x, H / 2 + level * H, z]} castShadow receiveShadow onClick={onClick} />
  );
}

function Ring({ q, r, level, color, opacity = 1 }: { q: number; r: number; level: number; color: string; opacity?: number }) {
  const [x, z] = pos(q, r);
  return (
    <mesh geometry={ring} position={[x, (level + 1) * H + 0.012, z]} rotation={[-Math.PI / 2, 0, 0]}>
      <meshBasicMaterial color={color} transparent opacity={opacity} side={THREE.DoubleSide} depthTest={false} />
    </mesh>
  );
}

function Target({ m, onClick }: { m: MoveView; onClick: (e: ThreeEvent<MouseEvent>) => void }) {
  const [x, z] = pos(m.to[0], m.to[1]);
  return (
    <mesh geometry={disc} position={[x, m.toLevel * H + 0.03, z]} onClick={onClick}>
      <meshBasicMaterial color="#22c55e" transparent opacity={0.55} />
    </mesh>
  );
}

export default function Board3D({ state, selected, targets, hint, onPieceClick, onTargetClick, onBackgroundClick }: BoardProps) {
  const controls = useRef<OrbitControlsImpl>(null);
  const center = useMemo(() => {
    if (state.pieces.length === 0) return new THREE.Vector3(0, 0, 0);
    let sx = 0,
      sz = 0;
    for (const p of state.pieces) {
      const [x, z] = pos(p.q, p.r);
      sx += x;
      sz += z;
    }
    return new THREE.Vector3(sx / state.pieces.length, 0, sz / state.pieces.length);
  }, [state.pieces]);

  useEffect(() => {
    const c = controls.current;
    if (!c) return;
    const delta = center.clone().sub(c.target);
    c.target.add(delta);
    c.object.position.add(delta);
    c.update();
  }, [center]);

  const sel = state.pieces.find((p) => p.name === selected);
  const last = state.lastMove;

  return (
    <Canvas shadows camera={{ position: [0, 11, 9], fov: 45 }} onPointerMissed={() => onBackgroundClick?.()} dpr={[1, 2]}>
      <color attach="background" args={["#e9e4d8"]} />
      <ambientLight intensity={0.7} />
      <directionalLight position={[6, 14, 8]} intensity={1.6} castShadow shadow-mapSize={[1024, 1024]} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.001, 0]} receiveShadow>
        <planeGeometry args={[200, 200]} />
        <meshStandardMaterial color="#d9d0bc" roughness={1} />
      </mesh>
      {state.pieces.map((p) => (
        <Piece
          key={p.name}
          bug={p.bug}
          color={p.color}
          q={p.q}
          r={p.r}
          level={p.level}
          onClick={
            p.onTop && onPieceClick
              ? (e) => {
                  e.stopPropagation();
                  onPieceClick(p.name);
                }
              : undefined
          }
        />
      ))}
      {last && <Ring q={last.to[0]} r={last.to[1]} level={last.toLevel} color="#f97316" opacity={0.9} />}
      {last?.from && <Ring q={last.from[0]} r={last.from[1]} level={-1} color="#f97316" opacity={0.5} />}
      {sel && <Ring q={sel.q} r={sel.r} level={sel.level} color="#2563eb" />}
      {hint && <Ring q={hint.to[0]} r={hint.to[1]} level={hint.toLevel - 1} color="#a855f7" />}
      {hint?.from && <Ring q={hint.from[0]} r={hint.from[1]} level={0} color="#a855f7" opacity={0.6} />}
      {targets.map((m) => (
        <Target
          key={m.notation}
          m={m}
          onClick={(e) => {
            e.stopPropagation();
            onTargetClick?.(m);
          }}
        />
      ))}
      <OrbitControls ref={controls} makeDefault maxPolarAngle={Math.PI / 2.3} minDistance={4} maxDistance={40} enableDamping />
    </Canvas>
  );
}
