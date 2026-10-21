"use client";

import { Canvas, useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { ContactShadows, Environment, Lightformer, OrbitControls } from "@react-three/drei";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { BUG_ART, paintColor } from "@/lib/bug-art";
import { TILE } from "@/lib/themes";
import { currentTheme } from "@/lib/theme-mode";
import type { BugLetter, ColorCode, MoveView } from "@/lib/engine-types";
import type { BoardProps } from "./board-types";

const R = 1; // cell radius
const H = 0.36; // tile thickness
const SQ3 = Math.sqrt(3);
const cellPos = (q: number, r: number) => [R * SQ3 * (q + r / 2), R * 1.5 * r] as const;

// ---- Geometry ---------------------------------------------------------------

function roundedHexShape(radius: number, corner: number) {
  const pts = Array.from({ length: 6 }, (_, i) => {
    const a = ((60 * i + 90) * Math.PI) / 180; // pointy along shape +y
    return new THREE.Vector2(radius * Math.cos(a), radius * Math.sin(a));
  });
  const s = new THREE.Shape();
  for (let i = 0; i < 6; i++) {
    const p = pts[(i + 5) % 6];
    const c = pts[i];
    const n = pts[(i + 1) % 6];
    const a = c.clone().lerp(p, corner);
    const b = c.clone().lerp(n, corner);
    if (i === 0) s.moveTo(a.x, a.y);
    else s.lineTo(a.x, a.y);
    s.quadraticCurveTo(c.x, c.y, b.x, b.y);
  }
  s.closePath();
  return s;
}

const BEVEL = 0.07;
const TILE_RADIUS = R * 0.93 - BEVEL;

const tileGeometry = (() => {
  const g = new THREE.ExtrudeGeometry(roundedHexShape(TILE_RADIUS, 0.2), {
    depth: H - 2 * BEVEL,
    bevelEnabled: true,
    bevelThickness: BEVEL,
    bevelSize: BEVEL,
    bevelSegments: 4,
    curveSegments: 6,
  });
  g.rotateX(-Math.PI / 2);
  g.translate(0, BEVEL, 0);
  g.computeVertexNormals();
  return g;
})();

const ringGeometry = new THREE.RingGeometry(R * 0.8, R * 0.95, 6, 1, Math.PI / 6);
const thinRingGeometry = new THREE.RingGeometry(R * 0.86, R * 0.93, 6, 1, Math.PI / 6);
const discGeometry = new THREE.CircleGeometry(R * 0.82, 6, Math.PI / 6);

// ---- Textures ---------------------------------------------------------------

const faceCache = new Map<string, { map: THREE.Texture; bump: THREE.Texture }>();

function drawGlyph(ctx: CanvasRenderingContext2D, bug: BugLetter, ink: string, size: number, mono?: string) {
  const glyph = size * 0.6;
  ctx.save();
  ctx.translate((size - glyph) / 2, (size - glyph) / 2);
  ctx.scale(glyph / 100, glyph / 100);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  for (const s of BUG_ART[bug]) {
    const path = new Path2D(s.d);
    ctx.globalAlpha = mono ? 1 : (s.opacity ?? 1);
    if (s.fill !== "none") {
      ctx.fillStyle = mono ?? paintColor(s.fill, bug, ink);
      ctx.fill(path);
    }
    if (s.stroke && s.stroke !== "none") {
      ctx.strokeStyle = mono ?? paintColor(s.stroke, bug, ink);
      ctx.lineWidth = (s.width ?? 1) + (mono ? 1.5 : 0);
      ctx.stroke(path);
    }
  }
  ctx.restore();
}

function faceTextures(bug: BugLetter, color: ColorCode) {
  const key = bug + color;
  const hit = faceCache.get(key);
  if (hit) return hit;
  const size = 512;
  const t = TILE[color];
  const make = (draw: (ctx: CanvasRenderingContext2D) => void, srgb: boolean) => {
    const c = document.createElement("canvas");
    c.width = c.height = size;
    draw(c.getContext("2d")!);
    const tex = new THREE.CanvasTexture(c);
    if (srgb) tex.colorSpace = THREE.SRGBColorSpace;
    // ExtrudeGeometry UVs are shape coordinates in [-r, r]; map them to [0, 1].
    const span = 2 * (TILE_RADIUS + BEVEL);
    tex.repeat.set(1 / span, 1 / span);
    tex.offset.set(0.5, 0.5);
    tex.anisotropy = 8;
    return tex;
  };
  const map = make((ctx) => {
    const g = ctx.createRadialGradient(size * 0.35, size * 0.3, size * 0.05, size * 0.5, size * 0.5, size * 0.7);
    const stops = color === "b" ? ["#232327", "#0f0f12"] : t.gradient;
    g.addColorStop(0, stops[0]);
    g.addColorStop(1, stops[1]);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
    drawGlyph(ctx, bug, t.ink, size);
  }, true);
  const bump = make((ctx) => {
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, size, size);
    ctx.filter = "blur(3px)";
    drawGlyph(ctx, bug, "#000", size, "#6a6a6a");
  }, false);
  const v = { map, bump };
  faceCache.set(key, v);
  return v;
}

function woodTexture(dark: boolean) {
  const size = 1024;
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const ctx = c.getContext("2d")!;
  const base = dark ? "#2a1f17" : "#b98b5c";
  const grain = dark ? "#1a120c" : "#8e6339";
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, size, size);
  // Plank seams and wavy grain lines.
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let plank = 0; plank < 6; plank++) {
    const y0 = (plank * size) / 6;
    ctx.fillStyle = `rgba(${dark ? "255,220,180" : "255,240,220"},${0.03 + rnd() * 0.05})`;
    ctx.fillRect(0, y0, size, size / 6);
    ctx.fillStyle = dark ? "rgba(0,0,0,0.5)" : "rgba(60,35,15,0.45)";
    ctx.fillRect(0, y0, size, 2);
    for (let i = 0; i < 26; i++) {
      const y = y0 + rnd() * (size / 6);
      ctx.strokeStyle = grain;
      ctx.globalAlpha = 0.08 + rnd() * 0.18;
      ctx.lineWidth = 0.6 + rnd() * 1.8;
      ctx.beginPath();
      const amp = 2 + rnd() * 6;
      const f = 0.004 + rnd() * 0.01;
      const ph = rnd() * 10;
      for (let x = 0; x <= size; x += 8) ctx.lineTo(x, y + Math.sin(x * f + ph) * amp);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(5, 5);
  tex.anisotropy = 8;
  return tex;
}

// ---- Pieces -----------------------------------------------------------------

const sideMaterials: Record<ColorCode, THREE.MeshPhysicalMaterial> = {
  w: new THREE.MeshPhysicalMaterial({ color: TILE.w.side, roughness: 0.42, clearcoat: 0.7, clearcoatRoughness: 0.25 }),
  b: new THREE.MeshPhysicalMaterial({ color: "#1d1d21", roughness: 0.4, clearcoat: 0.8, clearcoatRoughness: 0.2 }),
};

interface PieceProps {
  name: string;
  bug: BugLetter;
  color: ColorCode;
  q: number;
  r: number;
  level: number;
  lifted: boolean;
  onClick?: (e: ThreeEvent<MouseEvent>) => void;
}

function Piece({ bug, color, q, r, level, lifted, onClick }: PieceProps) {
  const ref = useRef<THREE.Group>(null);
  const materials = useMemo(() => {
    const { map, bump } = faceTextures(bug, color);
    const top = new THREE.MeshPhysicalMaterial({
      map,
      bumpMap: bump,
      bumpScale: 2.2,
      roughness: 0.38,
      clearcoat: 0.85,
      clearcoatRoughness: 0.18,
    });
    return [top, sideMaterials[color]];
  }, [bug, color]);

  const [x, z] = cellPos(q, r);
  const target = useMemo(() => new THREE.Vector3(x, level * H + (lifted ? 0.18 : 0), z), [x, z, level, lifted]);
  const anim = useRef<{ from: THREE.Vector3; to: THREE.Vector3; t: number } | null>(null);
  const first = useRef(true);

  useEffect(() => {
    const g = ref.current;
    if (!g) return;
    if (first.current) {
      g.position.copy(target);
      first.current = false;
      return;
    }
    anim.current = { from: g.position.clone(), to: target.clone(), t: 0 };
  }, [target]);

  useFrame((_, dt) => {
    const g = ref.current;
    const a = anim.current;
    if (!g || !a) return;
    const dist = a.from.distanceTo(a.to);
    a.t = Math.min(1, a.t + dt / (0.22 + Math.min(dist, 8) * 0.05));
    const e = a.t < 0.5 ? 2 * a.t * a.t : 1 - Math.pow(-2 * a.t + 2, 2) / 2;
    g.position.lerpVectors(a.from, a.to, e);
    // Hop: lift in an arc proportional to the distance travelled.
    if (dist > 0.3) g.position.y += Math.sin(Math.PI * e) * Math.min(1.4, 0.35 + dist * 0.12);
    if (a.t >= 1) anim.current = null;
  });

  return (
    <group ref={ref}>
      <mesh
        geometry={tileGeometry}
        material={materials}
        castShadow
        receiveShadow
        onClick={onClick}
        onPointerOver={onClick ? () => (document.body.style.cursor = "pointer") : undefined}
        onPointerOut={onClick ? () => (document.body.style.cursor = "") : undefined}
      />
    </group>
  );
}

function Marker({ q, r, level, color, opacity = 1, fill = 0, thin, onClick }: { q: number; r: number; level: number; color: string; opacity?: number; fill?: number; thin?: boolean; onClick?: (e: ThreeEvent<MouseEvent>) => void }) {
  const [x, z] = cellPos(q, r);
  const y = level * H + 0.015;
  return (
    <group position={[x, y, z]} rotation={[-Math.PI / 2, 0, 0]}>
      {fill > 0 && (
        <mesh geometry={discGeometry} onClick={onClick}>
          <meshBasicMaterial color={color} transparent opacity={fill} depthWrite={false} />
        </mesh>
      )}
      <mesh geometry={thin ? thinRingGeometry : ringGeometry} onClick={onClick}>
        <meshBasicMaterial color={color} transparent opacity={opacity} depthWrite={false} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

/** Smoothly pans the orbit target (and camera) to follow the centre of the hive. */
function CameraRig({ center }: { center: THREE.Vector3 }) {
  const controls = useThree((s) => s.controls) as unknown as OrbitControlsImpl | null;
  const first = useRef(true);
  useFrame(() => {
    if (!controls) return;
    const delta = center.clone().sub(controls.target);
    if (delta.lengthSq() < 1e-5) return;
    const step = first.current ? delta : delta.multiplyScalar(0.08);
    first.current = false;
    controls.target.add(step);
    controls.object.position.add(step);
    controls.update();
  });
  return null;
}

function useResolvedTheme() {
  const [t, setT] = useState<"light" | "dark">("light");
  useEffect(() => {
    setT(currentTheme());
    const on = () => setT(currentTheme());
    window.addEventListener("hive-theme", on);
    return () => window.removeEventListener("hive-theme", on);
  }, []);
  return t;
}

function Table({ dark }: { dark: boolean }) {
  const tex = useMemo(() => woodTexture(dark), [dark]);
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.002, 0]} receiveShadow>
      <planeGeometry args={[120, 120]} />
      <meshStandardMaterial map={tex} roughness={0.75} metalness={0} />
    </mesh>
  );
}

export default function Board3D({ state, selected, targets, previewTargets = [], hint, onPieceClick, onTargetClick, onBackgroundClick, hideLastMove }: BoardProps) {
  const controls = useRef<OrbitControlsImpl>(null);
  const theme = useResolvedTheme();
  const dark = theme === "dark";

  const center = useMemo(() => {
    if (state.pieces.length === 0) return new THREE.Vector3(0, 0, 0);
    let sx = 0,
      sz = 0;
    for (const p of state.pieces) {
      const [x, z] = cellPos(p.q, p.r);
      sx += x;
      sz += z;
    }
    return new THREE.Vector3(sx / state.pieces.length, 0, sz / state.pieces.length);
  }, [state.pieces]);

  const sel = state.pieces.find((p) => p.name === selected);
  const last = hideLastMove ? null : state.lastMove;
  const legalCells = new Set(targets.map((m) => `${m.to[0]},${m.to[1]}`));
  const preview = previewTargets.filter((m) => !legalCells.has(`${m.to[0]},${m.to[1]}`));
  const stackTop = (q: number, r: number) => Math.max(-1, ...state.pieces.filter((p) => p.q === q && p.r === r).map((p) => p.level)) + 1;

  return (
    <Canvas shadows camera={{ position: [0, 9.5, 8.5], fov: 42 }} onPointerMissed={() => onBackgroundClick?.()} dpr={[1, 2]}>
      <color attach="background" args={[dark ? "#0d1411" : "#e8dcc4"]} />
      <fog attach="fog" args={[dark ? "#0d1411" : "#e8dcc4", 22, 45]} />
      <hemisphereLight args={[dark ? "#9db8ff" : "#fff6e5", dark ? "#1b120a" : "#7a5a3a", dark ? 0.45 : 0.8]} />
      <directionalLight
        position={[5, 12, 7]}
        intensity={dark ? 1.4 : 2.2}
        color={dark ? "#ffd89a" : "#fff4e0"}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-12}
        shadow-camera-right={12}
        shadow-camera-top={12}
        shadow-camera-bottom={-12}
        shadow-bias={-0.0004}
      />
      <Environment resolution={128}>
        <Lightformer intensity={2} position={[0, 6, 0]} rotation={[Math.PI / 2, 0, 0]} scale={[10, 10, 1]} />
        <Lightformer intensity={1.2} position={[-6, 3, 4]} rotation={[0, Math.PI / 3, 0]} scale={[6, 2, 1]} color={dark ? "#f2c14e" : "#ffffff"} />
        <Lightformer intensity={0.8} position={[6, 2, -4]} rotation={[0, -Math.PI / 3, 0]} scale={[6, 2, 1]} />
      </Environment>
      <group position={[center.x, 0, center.z]}>
        <Table dark={dark} />
      </group>
      <ContactShadows position={[center.x, 0.001, center.z]} scale={30} blur={2.2} opacity={dark ? 0.7 : 0.45} far={2} resolution={1024} />

      {state.pieces.map((p) => (
        <Piece
          key={p.name}
          name={p.name}
          bug={p.bug}
          color={p.color}
          q={p.q}
          r={p.r}
          level={p.level}
          lifted={p.name === selected}
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

      {last && <Marker q={last.to[0]} r={last.to[1]} level={stackTop(last.to[0], last.to[1])} color={dark ? "#f2c14e" : "#c98a12"} opacity={0.95} />}
      {last?.from && <Marker q={last.from[0]} r={last.from[1]} level={stackTop(last.from[0], last.from[1])} color={dark ? "#f2c14e" : "#c98a12"} opacity={0.45} />}
      {sel && <Marker q={sel.q} r={sel.r} level={sel.level + 1} color={dark ? "#7aa8ff" : "#2b63d9"} opacity={1} />}
      {hint && <Marker q={hint.to[0]} r={hint.to[1]} level={hint.toLevel} color={dark ? "#bf94ff" : "#8b4fd6"} opacity={1} fill={0.25} />}
      {preview.map((m) => (
        <Marker key={"p" + m.notation} q={m.to[0]} r={m.to[1]} level={m.toLevel} color={dark ? "#ff7f68" : "#d84a33"} opacity={0.6} fill={0.05} thin />
      ))}
      {targets.map((m) => (
        <Marker
          key={m.notation}
          q={m.to[0]}
          r={m.to[1]}
          level={m.toLevel}
          color={dark ? "#72d483" : "#2f8a3c"}
          opacity={0.95}
          fill={0.3}
          onClick={(e) => {
            e.stopPropagation();
            onTargetClick?.(m);
          }}
        />
      ))}
      <CameraRig center={center} />
      <OrbitControls ref={controls} makeDefault maxPolarAngle={Math.PI / 2.4} minDistance={4} maxDistance={32} enableDamping dampingFactor={0.12} />
    </Canvas>
  );
}

export type { MoveView };
