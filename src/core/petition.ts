import { notifications } from "@mantine/notifications";
import axios, { type AxiosRequestConfig, type AxiosResponse } from "axios";
import appConfig from "./constants/appConfig";

/**
 * Configuración para peticiones
 * @template T - Tipo genérico de la petición (POST/PUT/PATCH)
 */
interface Petition<T = any> {
    /** Endpoint o URL*/
    endpoint: string;

    /**
     * Método
     * @default 'GET'
     */
    method?: "POST" | "GET" | "PUT" | "DELETE" | "PATCH";

    /**
     * Parámetros de consulta (query)
     * @remarks GET
     */
    params?: Record<string, any> | null;

    /**
     * Cuerpo de la petición
     * @remarks  POST, PUT, PATCH
     */
    data?: T | null;

    /** Headers adicionales */
    headers?: Record<string, string>;

    /** Mensaje personalizado para notificaciones de éxito */
    successMessage?: string;

    /** Mensaje alternativo para errores (sobrescribe el mensaje del servidor) */
    errorMessage?: string;

    /**
     * Controla si se muestran notificaciones toast
     * @default true
     */
    showNotifications?: boolean;

    /**
     * Tiempo máximo de espera para que la petición responsa (milisegundos)
     * @default 10000
     */
    timeout?: number;

    /**
     * ID en caso de petición tipo PATCH, PUT o DELETE (se añadirá a la URL como path param)
     */
    id?: string | number;
}

interface ApiErrorResponse {
    message?: string | string[];
    error?: string;
    statusCode?: number;
    [key: string]: any;
}

const DEFAULT_SUCCESS_MSG = "Solicitud completada con éxito";
const DEFAULT_ERROR_MSG = "Ocurrió un error al procesar la solicitud";
const DEFAULT_TIMEOUT = 10000;

const getErrorColor = (status?: number): "green" | "yellow" | "red" => {
    if (!status) return "red";
    if (status >= 200 && status < 300) return "green";
    if (status === 204 || status === 208) return "yellow";
    return "red";
};

const normalizeErrorMessage = (error: unknown, defaultMsg?: string): string => {
    if (defaultMsg) return defaultMsg;

    if (axios.isAxiosError(error)) {
        const errorData = error.response?.data as ApiErrorResponse | undefined;

        if (errorData?.message) {
            return Array.isArray(errorData.message) ? errorData.message.join(", ") : errorData.message;
        }

        return errorData?.error || error.message || DEFAULT_ERROR_MSG;
    }

    return error instanceof Error ? error.message : DEFAULT_ERROR_MSG;
};

/**
 * Realiza peticiones HTTP con configuración personalizada
 * @template T - Tipo esperado en la respuesta de la promesa
 * @param {Petition} config - Configuración de la petición
 * @returns {Promise<T>} - Promesa con datos de respuesta
 *
 * @example
 * // Ejemplo GETS
 * const data = await BasicPetition<Usuario>({
 *   endpoint: '/api/login',
 *   params: { email: 'example@gg.mx', pass: '123456' }
 * });
 *
 */

const cleanData = <T extends Record<string, any>>(data: T): Partial<T> => {
    return Object.entries(data)
        .filter(([, value]) => value !== null && value !== undefined)
        .reduce((acc, [key, value]) => ({ ...acc, [key]: value }), {} as Partial<T>);
};

export const BasicPetition = async <T>({ endpoint, method = "GET", params = null, data = null, headers = {}, successMessage = DEFAULT_SUCCESS_MSG, errorMessage, showNotifications = true, timeout = DEFAULT_TIMEOUT, id }: Petition): Promise<T> => {
    const config: AxiosRequestConfig = {
        // Para PUT/PATCH/DELETE se añade id como path parameter: /endpoint/{id}
        url: (method === "PUT" || method === "PATCH" || method === "DELETE") && id !== undefined ? `${appConfig.BACKEND_URL}${endpoint}/${id}` : `${appConfig.BACKEND_URL}${endpoint}`,
        method,
        headers: {
            "Content-Type": "application/json",
            // Añadir token Authorization automáticamente si existe en localStorage
            ...(typeof window !== 'undefined' && localStorage.getItem('mi_app_token') ? { Authorization: `Bearer ${localStorage.getItem('mi_app_token')}` } : {}),
            ...headers,
        },
        timeout,
    };

    if (method.toLowerCase() === "get") {
        config.params = params;
    } else if (data && typeof data === "object") {
        config.data = cleanData(data);
    }


    try {
        const response: AxiosResponse<T> = await axios(config);

        if (showNotifications) {
            notifications.show({
                title: "Éxito",
                message: successMessage,
                color: "green",
                autoClose: 3000,
            });
        }

        return response.data;
    } catch (error: unknown) {
        if (showNotifications) {
            notifications.show({
                title: "Error",
                message: normalizeErrorMessage(error, errorMessage),
                color: getErrorColor(axios.isAxiosError(error) ? error.response?.status : undefined),
                autoClose: 5000,
            });
        }

        if (axios.isAxiosError(error)) {
            throw {
                status: error.response?.status,
                message: normalizeErrorMessage(error, errorMessage),
                data: error.response?.data,
                code: error.code,
                originalError: error,
            };
        }

        throw error;
    } 
};
