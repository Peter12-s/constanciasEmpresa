import { useEffect, useState } from "react";

// Contador simple para múltiples peticiones concurrentes
let activeRequests = 0;

const eventTarget = new EventTarget();

const emit = () => {
    eventTarget.dispatchEvent(new CustomEvent("loading-change", { detail: activeRequests > 0 }));
};

export const startLoading = (): void => {
    activeRequests += 1;
    emit();
};

export const stopLoading = (): void => {
    activeRequests = Math.max(0, activeRequests - 1);
    emit();
};

export const isLoading = (): boolean => activeRequests > 0;

export const subscribeLoading = (cb: (loading: boolean) => void): (() => void) => {
    const listener = (e: Event) => {
        const custom = e as CustomEvent<boolean>;
        cb(Boolean(custom.detail));
    };

    eventTarget.addEventListener("loading-change", listener as EventListener);

    // enviar estado inicial
    cb(isLoading());

    return () => eventTarget.removeEventListener("loading-change", listener as EventListener);
};

// Hook React para usar en componentes
export const useGlobalLoading = (): boolean => {
    const [loading, setLoading] = useState<boolean>(isLoading());

    useEffect(() => {
        const unsubscribe = subscribeLoading(setLoading);
        return unsubscribe;
    }, []);

    return loading;
};
