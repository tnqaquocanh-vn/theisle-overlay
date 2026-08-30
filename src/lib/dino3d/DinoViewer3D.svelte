<script lang="ts">
  // 3D dino preview — vanilla three.js port of the official overlay app's
  // viewer (camera/lights/material values copied verbatim). three is
  // dynamic-imported so the main bundle stays light; assets come through the
  // Rust CDN cache (no CORS on the CDN).
  //
  // Performance contract (field report: tab switching lagged):
  // - Rebuild ONLY when species/palette actually change (key guard) — parent
  //   re-renders and kept-alive tab switches reuse the live scene.
  // - Parsed GLB + composited skin come from session caches (model-cache.ts,
  //   skin.ts); a rebuild of an already-seen dino is clone + retexture only.
  // - The render loop pauses whenever the canvas is not on screen.
  import { onDestroy, onMount } from "svelte";
  import { t } from "$lib/i18n";
  import { listenerBag, onCdnProgress } from "$lib/api";
  import { DINO_MODELS, DEFAULT_PALETTE, SHARED, type DinoPalette } from "./registry";
  import { buildSkin, patternUrls, skinKey } from "./skin";
  import { loadGltf } from "./model-cache";
  import bgImage from "../../assets/dino-viewer-bg.jpg";

  let {
    species,
    palette = null,
    pattern = 1,
    height = 300,
  }: {
    species: string;
    palette?: DinoPalette | null;
    /** Pattern slot (1-8); species only have previews for a few. */
    pattern?: number | string;
    height?: number;
  } = $props();

  const patStr = (): string => String(pattern ?? 1);

  let container: HTMLDivElement | undefined = $state();
  let status = $state<"loading" | "ready" | "no-model" | "error">("loading");

  // Download progress across THIS viewer's assets — models are 3-10 MB, so
  // the loading state shows real numbers instead of an opaque wait.
  let progressText = $state("");
  let watchedUrls = new Set<string>();
  const perUrl = new Map<string, { received: number; total: number }>();

  function refreshProgress() {
    let received = 0;
    let total = 0;
    for (const url of watchedUrls) {
      const p = perUrl.get(url);
      if (!p) continue;
      received += p.received;
      total += p.total;
    }
    progressText =
      total > 0
        ? `${(received / 1048576).toFixed(1)} / ${(total / 1048576).toFixed(1)} MB`
        : "";
  }

  onMount(() => {
    const bag = listenerBag();
    void bag.add(
      onCdnProgress((p) => {
        if (!watchedUrls.has(p.url)) return;
        perUrl.set(p.url, { received: p.received, total: p.total });
        refreshProgress();
      }),
    );
    return () => bag.dispose();
  });

  // One build at a time; a prop change supersedes the previous build.
  let generation = 0;
  let cleanup: (() => void) | null = null;
  /** Key of the scene currently built (or being built) — the rebuild guard. */
  let builtKey: string | null = null;
  /** Species the live scene was built for, and the handles a palette-only
   *  change needs — so re-colouring swaps two textures instead of tearing
   *  down the renderer, model and animation (the skin editor drags colours). */
  let live: {
    species: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    THREE: any;
    entry: (typeof DINO_MODELS)[string];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    skinMat: any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    eyeMat: any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mapTex: any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    normalTex: any;
  } | null = null;

  let recolorSeq = 0;

  /** Palette-only update: rebuild the skin canvases (cached in skin.ts) and
   *  swap the textures on the standing materials. */
  async function recolor(pal: DinoPalette) {
    const l = live;
    if (!l) return;
    const gen = generation; // a species change bumps this and aborts us
    const seq = ++recolorSeq; // a newer recolor supersedes this one
    const skin = await buildSkin(l.entry, pal, patStr());
    if (gen !== generation || live !== l || seq !== recolorSeq) return;
    const { THREE } = l;
    const nextMap = new THREE.CanvasTexture(skin.map);
    nextMap.flipY = false;
    nextMap.colorSpace = THREE.SRGBColorSpace;
    l.mapTex.dispose();
    l.mapTex = nextMap;
    l.skinMat.map = nextMap;
    if (skin.normal) {
      const nextN = new THREE.CanvasTexture(skin.normal);
      nextN.flipY = false;
      l.normalTex?.dispose();
      l.normalTex = nextN;
      l.skinMat.normalMap = nextN;
    }
    l.skinMat.needsUpdate = true;
    const eye = new THREE.Color(pal.eyes);
    l.eyeMat.color.copy(eye);
    l.eyeMat.emissive.copy(eye).multiplyScalar(0.4);
    status = "ready";
  }

  async function build(el: HTMLDivElement, sp: string, pal: DinoPalette) {
    const gen = ++generation;
    cleanup?.();
    cleanup = null;

    const entry = DINO_MODELS[sp];
    if (!entry) {
      status = "no-model";
      return;
    }
    status = "loading";
    perUrl.clear();
    progressText = "";
    const pu = patternUrls(entry, patStr());
    watchedUrls = new Set(
      [
        entry.glbModel,
        pu.patternUrl,
        pu.tmcUrl,
        entry.racMap,
        entry.normalMap,
        SHARED.detailNormal,
      ].filter((u): u is string => !!u),
    );
    try {
      const [THREE, { OrbitControls }, SkeletonUtils, gltf, skin] = await Promise.all([
        import("three"),
        import("three/examples/jsm/controls/OrbitControls.js"),
        import("three/examples/jsm/utils/SkeletonUtils.js"),
        loadGltf(entry),
        buildSkin(entry, pal, patStr()),
      ]);
      if (gen !== generation) return; // superseded while loading

      const width = el.clientWidth || 400;
      const renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: true,
        powerPreference: "high-performance",
      });
      // 1.5 is visually identical at this widget size and ~44% fewer pixels
      // than 2.0 on a HiDPI screen.
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
      renderer.setSize(width, height);
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 0.99;
      el.appendChild(renderer.domElement);

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 200);
      camera.position.set(-19.33, 0.89, -0.02);

      // The official viewer's intensities are LEGACY-lighting numbers (its
      // three predates r155). r185 is physically-based only, where the same
      // numbers render nearly black — scale by PI to reproduce the old look.
      const L = Math.PI;
      scene.add(new THREE.AmbientLight(0xffffff, 0.7 * L));
      scene.add(new THREE.HemisphereLight(0xcfe3ff, 0x3a2f28, 0.6 * L));
      const key = new THREE.DirectionalLight(0xfff2e6, 2.4 * L);
      key.position.set(6, 10, 6);
      scene.add(key);
      const fill = new THREE.DirectionalLight(0xbcd4ff, 0.7 * L);
      fill.position.set(-6, 4, -6);
      scene.add(fill);

      // Recoloured skin material (values copied from the official viewer).
      const mapTex = new THREE.CanvasTexture(skin.map);
      mapTex.flipY = false;
      mapTex.colorSpace = THREE.SRGBColorSpace;
      let normalTex: InstanceType<typeof THREE.CanvasTexture> | null = null;
      if (skin.normal) {
        normalTex = new THREE.CanvasTexture(skin.normal);
        normalTex.flipY = false;
      }
      const skinMat = new THREE.MeshStandardMaterial({
        map: mapTex,
        normalMap: normalTex,
        normalScale: new THREE.Vector2(1, 1),
        roughness: 0.95,
        metalness: 0,
        envMapIntensity: 0.4,
        side: THREE.DoubleSide,
      });
      const eyeColor = new THREE.Color(pal.eyes);
      const eyeMat = new THREE.MeshStandardMaterial({
        color: eyeColor,
        emissive: eyeColor.clone().multiplyScalar(0.4),
        roughness: 0.35,
        metalness: 0,
      });
      // Handles for the fast palette-only path (see `recolor`).
      live = { species: sp, THREE, entry, skinMat, eyeMat, mapTex, normalTex };

      // The cached gltf scene is a shared template — clone (SkeletonUtils
      // keeps skinned meshes/bones intact), then swap materials.
      const model = SkeletonUtils.clone(gltf.scene);
      model.traverse((obj: import("three").Object3D) => {
        const mesh = obj as import("three").Mesh;
        if (!mesh.isMesh) return;
        const matName = (Array.isArray(mesh.material) ? mesh.material[0] : mesh.material)
          ?.name ?? "";
        mesh.material = /eye|iris|pupil/i.test(matName) ? eyeMat : skinMat;
      });
      model.scale.setScalar(entry.glbScale);
      model.position.set(...entry.glbPosition);
      model.rotation.set(0, -Math.PI / 6, 0);
      scene.add(model);

      // Idle animation: the named preview clip, else the first one.
      let mixer: import("three").AnimationMixer | null = null;
      if (gltf.animations.length > 0) {
        mixer = new THREE.AnimationMixer(model);
        const clip = entry.previewClip
          ? (gltf.animations.find((a) => a.name === entry.previewClip) ?? gltf.animations[0])
          : gltf.animations[0];
        mixer.clipAction(clip).play();
      }

      const controls = new OrbitControls(camera, renderer.domElement);
      controls.enablePan = false;
      controls.minDistance = 8;
      controls.maxDistance = 40;

      // Render only while on screen — a kept-alive hidden tab (or scrolled-
      // away viewer) must cost zero GPU/CPU.
      let visible = true;
      const io = new IntersectionObserver((entries) => {
        const nowVisible = entries.some((e) => e.isIntersecting);
        if (nowVisible && !visible) {
          visible = true;
          clock.getDelta(); // swallow the hidden gap so the animation doesn't jump
          tick();
        } else {
          visible = nowVisible;
        }
      });
      io.observe(el);

      const clock = new THREE.Clock();
      let raf = 0;
      const tick = () => {
        if (!visible) return; // loop resumes from the observer
        raf = requestAnimationFrame(tick);
        mixer?.update(clock.getDelta());
        controls.update();
        renderer.render(scene, camera);
      };
      tick();

      const onResize = () => {
        const w = el.clientWidth || width;
        renderer.setSize(w, height);
        camera.aspect = w / height;
        camera.updateProjectionMatrix();
      };
      const ro = new ResizeObserver(onResize);
      ro.observe(el);

      cleanup = () => {
        visible = false;
        cancelAnimationFrame(raf);
        io.disconnect();
        ro.disconnect();
        controls.dispose();
        // `recolor` may have swapped these out — dispose the CURRENT textures.
        live?.mapTex?.dispose();
        live?.normalTex?.dispose();
        skinMat.dispose();
        eyeMat.dispose();
        live = null;
        // NOTE: geometries belong to the cached template — never disposed here.
        renderer.dispose();
        renderer.domElement.remove();
      };
      status = "ready";
    } catch (e) {
      if (gen === generation) {
        console.error("dino 3d viewer:", e);
        builtKey = null; // a retry (prop change back) must rebuild
        status = "error";
      }
    }
  }

  $effect(() => {
    const el = container;
    const sp = species;
    const pal = palette ?? DEFAULT_PALETTE;
    const pat = patStr();
    if (!el) return;
    // Rebuild guard: parent re-renders hand in NEW palette objects with the
    // SAME contents — only an actual content change rebuilds the scene.
    const key = skinKey(sp, pal, pat);
    if (key === builtKey) return;
    builtKey = key;
    // Same species + a live scene → swap textures (palette OR pattern change),
    // keeping camera + animation.
    if (live && live.species === sp && status === "ready") {
      void recolor(pal);
    } else {
      void build(el, sp, pal);
    }
  });

  onDestroy(() => {
    generation++;
    cleanup?.();
    cleanup = null;
  });
</script>

<div
  class="viewer-bg relative w-full"
  style="height: {height}px; background-image: linear-gradient(rgba(10, 13, 9, 0.18), rgba(10, 13, 9, 0.32)), url({bgImage})"
>
  <div bind:this={container} class="absolute inset-0"></div>
  {#if status !== "ready"}
    <div
      class="absolute inset-0 flex items-center justify-center text-sm"
      style="color: #eae6d6; text-shadow: 0 1px 3px rgba(0,0,0,0.9)"
    >
      {#if status === "loading"}
        {$t("dino3d.loading")}{progressText ? ` ${progressText}` : ""}
      {:else if status === "no-model"}
        {$t("dino3d.no_model")}
      {:else}
        {$t("dino3d.error")}
      {/if}
    </div>
  {/if}
</div>

<style>
  .viewer-bg {
    background-size: cover;
    background-position: center;
  }
</style>
