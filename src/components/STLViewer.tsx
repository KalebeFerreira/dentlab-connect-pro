import { Suspense } from "react";
import { Canvas, useLoader } from "@react-three/fiber";
import { OrbitControls, Stage } from "@react-three/drei";
import { STLLoader } from "three/addons/loaders/STLLoader.js";
import { Loader2 } from "lucide-react";

interface STLModelProps {
  url: string;
}

function STLModel({ url }: STLModelProps) {
  const geometry = useLoader(STLLoader, url);
  
  return (
    <mesh geometry={geometry}>
      <meshStandardMaterial color="#8b5cf6" metalness={0.5} roughness={0.5} />
    </mesh>
  );
}

interface STLViewerProps {
  fileUrl: string;
}

export const STLViewer = ({ fileUrl }: STLViewerProps) => {
  return (
    <div className="w-full h-[500px] bg-background rounded-lg border">
      <Canvas camera={{ position: [0, 0, 100], fov: 50 }}>
        <Suspense fallback={null}>
          <Stage environment="city" intensity={0.6}>
            <STLModel url={fileUrl} />
          </Stage>
          <OrbitControls makeDefault />
        </Suspense>
        <ambientLight intensity={0.5} />
        <directionalLight position={[10, 10, 5]} intensity={1} />
        <directionalLight position={[-10, -10, -5]} intensity={0.5} />
      </Canvas>
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="text-muted-foreground text-sm">
          Use o mouse para rotacionar, scroll para zoom
        </div>
      </div>
    </div>
  );
};

export const STLViewerLoading = () => {
  return (
    <div className="w-full h-[500px] bg-background rounded-lg border flex items-center justify-center">
      <div className="flex flex-col items-center gap-2">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Carregando modelo 3D...</p>
      </div>
    </div>
  );
};
