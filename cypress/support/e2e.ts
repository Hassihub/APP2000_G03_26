// Lastes automatisk før alle spec-filer
import "./commands";

// Ignorer Next.js hydration-feil og geolocation-feil i konsollen –
// disse er ikke relevante for E2E-tester
Cypress.on("uncaught:exception", (err) => {
  if (
    err.message.includes("Hydration") ||
    err.message.includes("hydration") ||
    err.message.includes("geolocation") ||
    err.message.includes("ResizeObserver") ||
    // NetworkError skjer når en fetch avbrytes under navigasjon –
    // Cypress bytter side mens appen fortsatt laster, ikke en reell feil
    err.message.includes("NetworkError") ||
    err.message.includes("Failed to fetch") ||
    err.message.includes("Load failed")
  ) {
    return false;
  }
});
