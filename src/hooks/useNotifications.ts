import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const useNotifications = () => {
  const [permission, setPermission] = useState<NotificationPermission>("default");
  const [isSupported, setIsSupported] = useState(false);

  useEffect(() => {
    // Check if notifications are supported
    setIsSupported("Notification" in window && "serviceWorker" in navigator);
    
    if ("Notification" in window) {
      setPermission(Notification.permission);
    }
  }, []);

  const requestPermission = async () => {
    if (!isSupported) {
      toast.error("Notificações não são suportadas neste navegador");
      return false;
    }

    try {
      const result = await Notification.requestPermission();
      setPermission(result);

      if (result === "granted") {
        // Subscribe user to push notifications
        await subscribeUserToPush();
        toast.success("Notificações ativadas com sucesso!");
        return true;
      } else if (result === "denied") {
        toast.error("Você bloqueou as notificações. Ative nas configurações do navegador.");
        return false;
      }
      return false;
    } catch (error) {
      console.error("Error requesting notification permission:", error);
      toast.error("Erro ao solicitar permissão para notificações");
      return false;
    }
  };

  const subscribeUserToPush = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Register service worker
      const registration = await navigator.serviceWorker.ready;

      // For now, we'll just mark that the user wants notifications
      // In a production app, you'd generate VAPID keys and subscribe to push service
      console.log("Service worker ready:", registration);
      
      // Store notification preference
      localStorage.setItem("notifications_enabled", "true");
    } catch (error) {
      console.error("Error subscribing to push:", error);
      throw error;
    }
  };

  const showNotification = (title: string, options?: NotificationOptions) => {
    if (permission === "granted" && isSupported) {
      new Notification(title, options);
    }
  };

  const testNotification = () => {
    showNotification("Lembrete de Agendamento", {
      body: "Você tem um agendamento amanhã às 14:00",
      icon: "/icon-192x192.png",
      badge: "/icon-192x192.png",
      tag: "appointment-reminder",
    });
  };

  return {
    permission,
    isSupported,
    requestPermission,
    showNotification,
    testNotification,
  };
};
