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

const BEVEL = 0.11;
const TILE_RADIUS = R * 0.94 - BEVEL;

const tileGeometry = (() => {
  const g = new THREE.ExtrudeGeometry(roundedHexShape(TILE_RADIUS, 0.22), {
    depth: H - 2 * BEVEL,
    bevelEnabled: true,
    bevelThickness: BEVEL,
    bevelSize: BEVEL,
    bevelSegments: 6,
    curveSegments: 8,
  });
  g.rotateX(-Math.PI / 2);
  g.translate(0, BEVEL, 0);
  g.computeVertexNormals();
  return g;
})();

const decalGeometry = new THREE.PlaneGeometry(R * 2.1, R * 2.1);

// ---- Textures ---------------------------------------------------------------

// One body colour per side, used for the whole tile so the top and the sides
// read as a single moulded piece. The glyph is engraved into it.
const BODY: Record<ColorCode, string> = { w: "#ece3cf", b: "#2a292e" };
const GROOVE: Record<ColorCode, string> = { w: "#b9ab8c", b: "#141317" };

const faceCache = new Map<string, { map: THREE.Texture; bump: THREE.Texture }>();

function drawGlyph(ctx: CanvasRenderingContext2D, bug: BugLetter, ink: string, size: number, mono?: string, grow = 0) {
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
      if (grow) {
        ctx.strokeStyle = mono ?? paintColor(s.fill, bug, ink);
        ctx.lineWidth = grow;
        ctx.stroke(path);
      }
    }
    if (s.stroke && s.stroke !== "none") {
      ctx.strokeStyle = mono ?? paintColor(s.stroke, bug, ink);
      ctx.lineWidth = (s.width ?? 1) + grow;
      ctx.stroke(path);
    }
  }
  ctx.restore();
}

function canvasTexture(size: number, draw: (ctx: CanvasRenderingContext2D) => void, srgb: boolean) {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  draw(c.getContext("2d")!);
  const tex = new THREE.CanvasTexture(c);
  if (srgb) tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

function faceTextures(bug: BugLetter, color: ColorCode) {
  const key = bug + color;
  const hit = faceCache.get(key);
  if (hit) return hit;
  const size = 1024;
  const t = TILE[color];
  const fit = (tex: THREE.Texture) => {
    // ExtrudeGeometry UVs are shape coordinates in [-r, r]; map them to [0, 1].
    const span = 2 * (TILE_RADIUS + BEVEL);
    tex.repeat.set(1 / span, 1 / span);
    tex.offset.set(0.5, 0.5);
    return tex;
  };
  const map = canvasTexture(
    size,
    (ctx) => {
      ctx.fillStyle = BODY[color];
      ctx.fillRect(0, 0, size, size);
      // The groove: a slightly darker channel around the painted bug.
      drawGlyph(ctx, bug, t.ink, size, GROOVE[color], 3);
      drawGlyph(ctx, bug, t.ink, size);
    },
    true,
  );
  const bump = canvasTexture(
    size,
    (ctx) => {
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, size, size);
      ctx.filter = "blur(2.5px)";
      drawGlyph(ctx, bug, "#000", size, "#3a3a3a", 2.5);
    },
    false,
  );
  const v = { map: fit(map), bump: fit(bump) };
  faceCache.set(key, v);
  return v;
}

/** The sheet of graph paper the hive sits on, matching the 2D board. */
function paperTexture(paper: string, line: string) {
  const size = 512;
  const tex = canvasTexture(
    size,
    (ctx) => {
      ctx.fillStyle = paper;
      ctx.fillRect(0, 0, size, size);
      let seed = 11;
      const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
      // paper fibres
      for (let i = 0; i < 2400; i++) {
        ctx.fillStyle = rnd() < 0.5 ? "rgba(0,0,0,0.035)" : "rgba(255,255,255,0.05)";
        ctx.fillRect(rnd() * size, rnd() * size, 1 + rnd() * 2, 1);
      }
      ctx.strokeStyle = line;
      ctx.globalAlpha = 0.55;
      ctx.lineWidth = 2;
      for (let i = 0; i <= 4; i++) {
        const p = (i * size) / 4;
        ctx.beginPath();
        ctx.moveTo(p, 0);
        ctx.lineTo(p, size);
        ctx.moveTo(0, p);
        ctx.lineTo(size, p);
        ctx.stroke();
      }
    },
    true,
  );
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(30, 30);
  return tex;
}

function rand(seed: number) {
  let s = seed * 9301 + 49297;
  return () => ((s = (s * 9301 + 49297) % 233280) / 233280);
}

/** Painted marks laid flat on the paper: watercolour dots, ink rings, washes. */
type MarkKind = "dot" | "ring" | "dashed" | "halo" | "hex";
function markTexture(kind: MarkKind, color: string, seed = 1) {
  const size = 256;
  const c = size / 2;
  return canvasTexture(
    size,
    (ctx) => {
      const rnd = rand(seed);
      ctx.clearRect(0, 0, size, size);
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      const hex = (r: number, jitter: number) => {
        ctx.beginPath();
        for (let i = 0; i <= 6; i++) {
          const a = ((60 * i - 90) * Math.PI) / 180;
          const rr = r * (1 + (rnd() - 0.5) * jitter);
          const x = c + rr * Math.cos(a);
          const y = c + rr * Math.sin(a);
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.closePath();
      };
      if (kind === "dot") {
        // A watercolour blot: layered soft discs and a darker drying edge.
        ctx.fillStyle = color;
        for (let i = 0; i < 5; i++) {
          ctx.globalAlpha = 0.16;
          ctx.beginPath();
          ctx.ellipse(c + (rnd() - 0.5) * 8, c + (rnd() - 0.5) * 8, 30 + rnd() * 6, 28 + rnd() * 6, rnd() * 3, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.globalAlpha = 0.85;
        ctx.strokeStyle = color;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.ellipse(c, c, 33, 31, rnd(), 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 1;
        ctx.beginPath();
        ctx.arc(c, c, 9, 0, Math.PI * 2);
        ctx.fill();
      } else if (kind === "ring" || kind === "dashed") {
        ctx.strokeStyle = color;
        ctx.lineWidth = 6;
        ctx.globalAlpha = 0.95;
        if (kind === "dashed") ctx.setLineDash([10, 12]);
        ctx.beginPath();
        ctx.ellipse(c, c, 44, 42, rnd(), 0, Math.PI * 2);
        ctx.stroke();
      } else if (kind === "halo") {
        const g = ctx.createRadialGradient(c, c, size * 0.3, c, c, size * 0.5);
        g.addColorStop(0, color);
        g.addColorStop(1, "transparent");
        ctx.fillStyle = g;
        ctx.globalAlpha = 0.6;
        hex(size * 0.5, 0.04);
        ctx.fill();
      } else {
        ctx.strokeStyle = color;
        ctx.lineWidth = 6;
        ctx.setLineDash(seed % 2 ? [14, 10] : []);
        hex(size * 0.44, 0.05);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.globalAlpha = 0.45;
        ctx.lineWidth = 2.5;
        hex(size * 0.41, 0.07);
        ctx.stroke();
      }
    },
    true,
  );
}

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
    const finish = { roughness: 0.46, clearcoat: 0.35, clearcoatRoughness: 0.35, sheen: 0 };
    // Caps carry the engraved glyph; sides and bevels are the same body colour.
    const top = new THREE.MeshPhysicalMaterial({ ...finish, map, bumpMap: bump, bumpScale: 3.2 });
    const side = new THREE.MeshPhysicalMaterial({ ...finish, color: BODY[color] });
    return [top, side];
  }, [bug, color]);

  const [x, z] = cellPos(q, r);
  const target = useMemo(() => new THREE.Vector3(x, level * H + (lifted ? 0.32 : 0), z), [x, z, level, lifted]);
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

function Mark({ q, r, y, tex, scale = 1, onClick }: { q: number; r: number; y: number; tex: THREE.Texture; scale?: number; onClick?: (e: ThreeEvent<MouseEvent>) => void }) {
  const [x, z] = cellPos(q, r);
  return (
    <mesh
      geometry={decalGeometry}
      position={[x, y + 0.012, z]}
      rotation={[-Math.PI / 2, 0, 0]}
      scale={scale}
      renderOrder={2}
      onClick={onClick}
      onPointerOver={onClick ? () => (document.body.style.cursor = "pointer") : undefined}
      onPointerOut={onClick ? () => (document.body.style.cursor = "") : undefined}
    >
      <meshBasicMaterial map={tex} transparent depthWrite={false} toneMapped={false} />
    </mesh>
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

function cssVar(name: string, fallback: string) {
  if (typeof document === "undefined") return fallback;
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
}

/** Colours and painted textures for the current day/night theme. */
function usePalette(theme: "light" | "dark") {
  return useMemo(() => {
    const dark = theme === "dark";
    const paper = cssVar("--board", dark ? "#122a42" : "#f1e9d6");
    const line = cssVar("--board-dot", dark ? "#234363" : "#dccfb2");
    const move = cssVar("--move", "#2c52a0");
    const select = cssVar("--select", "#1d3a80");
    const threat = cssVar("--threat", "#c2452a");
    const accent = cssVar("--accent", "#b9862a");
    const violet = cssVar("--violet", "#7a4ea3");
    return {
      paper,
      paperTex: paperTexture(paper, line),
      dot: markTexture("dot", move, 3),
      ring: markTexture("ring", violet, 5),
      dashed: markTexture("dashed", threat, 7),
      halo: markTexture("halo", accent, 2),
      lastFrom: markTexture("hex", accent, 1),
      sel: markTexture("hex", select, 4),
    };
  }, [theme]);
}

function Paper({ tex }: { tex: THREE.Texture }) {
  return (
    // Unlit, so the sheet matches the page colour exactly; ContactShadows grounds the tiles.
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.002, 0]}>
      <planeGeometry args={[120, 120]} />
      <meshBasicMaterial map={tex} toneMapped={false} />
    </mesh>
  );
}

export default function Board3D({ state, selected, targets, previewTargets = [], hint, onPieceClick, onTargetClick, onBackgroundClick, hideLastMove }: BoardProps) {
  const controls = useRef<OrbitControlsImpl>(null);
  const theme = useResolvedTheme();
  const dark = theme === "dark";
  const pal = usePalette(theme);

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
    <Canvas shadows={{ type: THREE.PCFSoftShadowMap }} camera={{ position: [0, 9.5, 8.5], fov: 40 }} onPointerMissed={() => onBackgroundClick?.()} dpr={[1, 2]}>
      <color attach="background" args={[pal.paper]} />
      <fog attach="fog" args={[pal.paper, 16, 38]} />
      <hemisphereLight args={[dark ? "#dbe9ff" : "#fffaf0", dark ? "#0b1a2a" : "#b9a27c", dark ? 0.9 : 1.05]} />
      <directionalLight
        position={[-4, 12, 6]}
        intensity={dark ? 1.5 : 1.9}
        color={dark ? "#f4f8ff" : "#fff6e6"}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-12}
        shadow-camera-right={12}
        shadow-camera-top={12}
        shadow-camera-bottom={-12}
        shadow-bias={-0.0004}
        shadow-radius={6}
      />
      <Environment resolution={128}>
        <Lightformer intensity={1.4} position={[0, 6, 0]} rotation={[Math.PI / 2, 0, 0]} scale={[10, 10, 1]} />
        <Lightformer intensity={0.7} position={[-6, 3, 4]} rotation={[0, Math.PI / 3, 0]} scale={[6, 2, 1]} />
      </Environment>
      <group position={[center.x, 0, center.z]}>
        <Paper tex={pal.paperTex} />
      </group>
      <ContactShadows position={[center.x, 0.001, center.z]} scale={30} blur={2.6} opacity={dark ? 0.55 : 0.38} far={2} resolution={1024} color={dark ? "#000814" : "#3a2a17"} />

      {last && <Mark q={last.to[0]} r={last.to[1]} y={0} tex={pal.halo} scale={1.12} />}
      {last?.from && stackTop(last.from[0], last.from[1]) === 0 && <Mark q={last.from[0]} r={last.from[1]} y={0} tex={pal.lastFrom} scale={0.95} />}
      {sel && <Mark q={sel.q} r={sel.r} y={sel.level * H} tex={pal.sel} scale={1.04} />}

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

      {hint && <Mark q={hint.to[0]} r={hint.to[1]} y={hint.toLevel * H} tex={pal.ring} scale={1.1} />}
      {preview.map((m) => (
        <Mark key={"p" + m.notation} q={m.to[0]} r={m.to[1]} y={m.toLevel * H} tex={pal.dashed} />
      ))}
      {targets.map((m) => (
        <Mark
          key={m.notation}
          q={m.to[0]}
          r={m.to[1]}
          y={m.toLevel * H}
          tex={pal.dot}
          scale={1.15}
          onClick={(e) => {
            e.stopPropagation();
            onTargetClick?.(m);
          }}
        />
      ))}
      <CameraRig center={center} />
      <OrbitControls ref={controls} makeDefault maxPolarAngle={Math.PI / 2.5} minDistance={4} maxDistance={30} enableDamping dampingFactor={0.12} />
    </Canvas>
  );
}

export type { MoveView };
