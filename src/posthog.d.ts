/**
 * The PostHog snippet in index.html puts posthog on window. This tells
 * TypeScript about it so the capture calls compile, without adding a package
 * dependency for what is three method signatures.
 */
declare global {
  interface Window {
    posthog?: {
      capture: (event: string, properties?: Record<string, unknown>) => void;
      identify: (id: string, properties?: Record<string, unknown>) => void;
      reset: () => void;
    };
  }
}

export {};
