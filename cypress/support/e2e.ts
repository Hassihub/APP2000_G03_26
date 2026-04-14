// Lastes automatisk før alle spec-filer
import "./commands";

// Ignorer Next.js hydration-feil og geolocation-feil i konsollen –
// disse er ikke relevante for E2E-tester
Cypress.on("uncaught:exception", (err) => {
  if (
    err.message.includes("Hydration") ||
    err.message.includes("hydration") ||
    err.message.includes("geolocation") ||
    err.message.includes("ResizeObserver")
  ) {
    return false;
  }
});
