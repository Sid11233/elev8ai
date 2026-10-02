"use client";

import { useState } from "react";

import { cn } from "@/lib/utils";

// The seal mark. Renders public/brand/logo-seal.png (then .jpg) once it loads;
// until then (and if neither exists) it shows a clean monogram so the UI never
// flashes a broken image. Never stretched, recolored, or shadowed — the art
// carries its own depth.
export function BrandSeal({ size = 32, className }: { size?: number; className?: string }) {
  const [src, setSrc] = useState("/brand/logo-seal.png");
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);

  function onError() {
    if (src.endsWith(".png")) setSrc("/brand/logo-seal.jpg");
    else setFailed(true);
  }

  return (
    <span
      className={cn("relative inline-flex shrink-0 items-center justify-center", className)}
      style={{ width: size, height: size }}
    >
      {!loaded && (
        <span
          aria-hidden
          className="inline-flex size-full items-center justify-center rounded-full bg-primary font-bold text-primary-foreground"
          style={{ fontSize: size * 0.5 }}
        >
          l
        </span>
      )}
      {!failed && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          // Callback ref catches a cached image that finished before React
          // could attach onLoad.
          ref={(img) => {
            if (img?.complete) {
              if (img.naturalWidth > 0) setLoaded(true);
              else onError();
            }
          }}
          src={src}
          alt=""
          width={size}
          height={size}
          className={cn("absolute inset-0 size-full object-contain", !loaded && "opacity-0")}
          onLoad={() => setLoaded(true)}
          onError={onError}
        />
      )}
    </span>
  );
}
