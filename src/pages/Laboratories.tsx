import { LaboratoryList } from "@/components/LaboratoryList";

export default function Laboratories() {
  // Redirect to the unified laboratory dashboard
  window.location.href = "/laboratory";
  
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center justify-center min-h-[50vh]">
        <p className="text-muted-foreground">Redirecionando...</p>
      </div>
    </div>
  );
}
