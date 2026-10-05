import React, { useEffect, useRef } from 'react';

interface BangladeshBackgroundProps {
  theme: 'light' | 'dark';
}

export default function BangladeshBackground({ theme }: BangladeshBackgroundProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };

    window.addEventListener('resize', handleResize);

    // Geodetic Survey Benchmark Nodes (Coordinates across Bangladesh delta)
    const benchmarkLabels = [
      '23.81°N 90.41°E [DHAKA]',
      '22.35°N 91.78°E [CTG]',
      '24.89°N 91.86°E [SYL]',
      '24.36°N 88.60°E [RAJ]',
      '22.84°N 89.54°E [KHL]',
      '22.70°N 90.35°E [BAR]',
      '25.74°N 89.27°E [RNG]',
      '24.74°N 90.40°E [MYM]',
      '23.84°N 90.25°E [SAVAR]',
      '21.42°N 92.00°E [COXS]'
    ];

    interface Node {
      x: number;
      y: number;
      vx: number;
      vy: number;
      radius: number;
      label: string;
      alpha: number;
    }

    const nodeCount = 20;
    const nodes: Node[] = [];

    for (let i = 0; i < nodeCount; i++) {
      nodes.push({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.25,
        vy: (Math.random() - 0.5) * 0.25,
        radius: Math.random() * 1.5 + 1,
        label: benchmarkLabels[i % benchmarkLabels.length],
        alpha: Math.random() * 0.4 + 0.2
      });
    }

    let tick = 0;

    const render = () => {
      ctx.clearRect(0, 0, width, height);
      tick += 0.005;

      const isDark = theme === 'dark';
      const lineColor = isDark ? 'rgba(52, 211, 153, 0.04)' : 'rgba(5, 150, 105, 0.04)';
      const nodeColor = isDark ? 'rgba(52, 211, 153, ' : 'rgba(5, 150, 105, ';
      const textFill = isDark ? 'rgba(161, 161, 170, 0.25)' : 'rgba(100, 116, 139, 0.3)';

      // 1. Draw subtle cadastral vector mesh
      for (let i = 0; i < nodes.length; i++) {
        const n1 = nodes[i];

        // Move nodes gently
        n1.x += n1.vx;
        n1.y += n1.vy;

        if (n1.x < 0) n1.x = width;
        if (n1.x > width) n1.x = 0;
        if (n1.y < 0) n1.y = height;
        if (n1.y > height) n1.y = 0;

        // Draw connections between nearby nodes
        for (let j = i + 1; j < nodes.length; j++) {
          const n2 = nodes[j];
          const dx = n1.x - n2.x;
          const dy = n1.y - n2.y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < 220) {
            ctx.beginPath();
            ctx.strokeStyle = lineColor;
            ctx.lineWidth = 1 - dist / 220;
            ctx.moveTo(n1.x, n1.y);
            ctx.lineTo(n2.x, n2.y);
            ctx.stroke();
          }
        }

        // Draw node points
        ctx.beginPath();
        ctx.arc(n1.x, n1.y, n1.radius, 0, Math.PI * 2);
        ctx.fillStyle = `${nodeColor}${n1.alpha})`;
        ctx.fill();

        // Draw coordinate text label on selected nodes
        if (i % 3 === 0) {
          ctx.font = '9px "JetBrains Mono", monospace';
          ctx.fillStyle = textFill;
          ctx.fillText(n1.label, n1.x + 8, n1.y + 3);
        }
      }

      // 2. Draw subtle meandering delta flow curves
      ctx.beginPath();
      ctx.strokeStyle = isDark ? 'rgba(52, 211, 153, 0.03)' : 'rgba(16, 185, 129, 0.03)';
      ctx.lineWidth = 1.5;
      for (let x = 0; x < width; x += 15) {
        const y = Math.sin(x * 0.003 + tick) * 40 + Math.cos(x * 0.0015 - tick * 0.5) * 30 + height * 0.65;
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationFrameId);
    };
  }, [theme]);

  return (
    <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden select-none">
      {/* Bangladesh Sovereign Identity Atmospheric Orbs (Deep Forest Green & Crimson Sun) */}
      <div 
        className={`absolute -top-32 -left-32 w-96 h-96 rounded-full blur-[140px] transition-opacity duration-700 ${
          theme === 'dark' ? 'bg-emerald-500/10' : 'bg-emerald-600/5'
        }`} 
      />
      <div 
        className={`absolute top-1/4 -right-24 w-[420px] h-[420px] rounded-full blur-[160px] transition-opacity duration-700 ${
          theme === 'dark' ? 'bg-red-600/[0.04]' : 'bg-red-500/[0.03]'
        }`} 
      />
      <div 
        className={`absolute -bottom-40 left-1/3 w-[500px] h-[500px] rounded-full blur-[180px] transition-opacity duration-700 ${
          theme === 'dark' ? 'bg-emerald-600/[0.06]' : 'bg-emerald-500/[0.04]'
        }`} 
      />

      {/* HTML5 Canvas with Cadastral Spatial Vector Nodes */}
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full opacity-80" />
    </div>
  );
}
