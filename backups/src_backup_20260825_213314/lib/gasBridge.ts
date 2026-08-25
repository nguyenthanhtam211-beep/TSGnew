/**
 * GAS Bridge - Unified API client supporting both Google Apps Script & Standalone Server
 */

declare global {
  interface Window {
    google?: {
      script?: {
        run: {
          withSuccessHandler: (cb: (res: any) => void) => any;
          withFailureHandler: (cb: (err: any) => void) => any;
          [key: string]: any;
        };
      };
    };
  }
}

export const isGoogleAppsScript = (): boolean => {
  return typeof window !== 'undefined' && Boolean(window.google?.script?.run);
};

export const callGasBackend = <T = any>(functionName: string, ...args: any[]): Promise<T> => {
  return new Promise((resolve, reject) => {
    if (isGoogleAppsScript() && window.google?.script?.run) {
      const runner = window.google.script.run
        .withSuccessHandler((result: any) => {
          try {
            const parsed = typeof result === 'string' ? JSON.parse(result) : result;
            resolve(parsed);
          } catch (e) {
            resolve(result as T);
          }
        })
        .withFailureHandler((error: any) => {
          console.error(`GAS Function ${functionName} failed:`, error);
          reject(error);
        });

      if (typeof runner[functionName] === 'function') {
        runner[functionName](...args);
      } else {
        reject(new Error(`GAS Function "${functionName}" is not defined.`));
      }
    } else {
      reject(new Error("Not running inside Google Apps Script environment."));
    }
  });
};

export const fetchGasOrApi = async <T = any>(
  gasFnName: string,
  apiEndpoint: string,
  fetchOptions?: RequestInit,
  gasArgs: any[] = []
): Promise<T> => {
  if (isGoogleAppsScript()) {
    return callGasBackend<T>(gasFnName, ...gasArgs);
  }

  const res = await fetch(apiEndpoint, fetchOptions);
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || `HTTP ${res.status} error from ${apiEndpoint}`);
  }
  return data as T;
};
