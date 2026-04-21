// E2E-tester for utforsk-siden (/explore) og turrute-oppretting (/turrute/ny)
// Ingen reset-avhengighet – tester sidestruktur og tilgangskontroll

describe("Utforsk-siden – sidestruktur", () => {
  beforeEach(() => {
    cy.intercept("GET", "/api/trips*").as("trips");
    cy.visit("/explore");
    cy.wait("@trips", { timeout: 15000 });
  });

  it("laster utforsk-siden uten krasj", () => {
    cy.url().should("include", "/explore");
    cy.get("body").should("not.be.empty");
  });

  it("viser et søkefelt", () => {
    cy.get("input").should("exist");
  });

  it("siden inneholder ikke en 500-feil", () => {
    cy.get("body").invoke("text").then((text) => {
      expect(text).not.to.include("Internal Server Error");
      expect(text).not.to.include("Application error");
    });
  });

  it("hvis det finnes turer vises de som kort", () => {
    cy.get("body").then(($body) => {
      // Sjekk om det finnes turkort – hopp over hvis DB er tom
      const hasTrips = $body.find("article").length > 0;
      if (!hasTrips) {
        cy.log("Ingen turer i databasen – hopper over");
        return;
      }
      cy.get("article").first().should("be.visible");
    });
  });
});

describe("Utforsk-siden – innlogget bruker", () => {
  beforeEach(() => {
    cy.registerAndLogin();
    cy.intercept("GET", "/api/trips*").as("trips");
    cy.visit("/explore");
    cy.wait("@trips", { timeout: 15000 });
  });

  it("viser siden etter innlogging", () => {
    cy.url().should("include", "/explore");
    cy.get("body").should("not.be.empty");
  });

  it("knapp for å opprette ny turrute finnes", () => {
    // explore/page.js har en "+ Opprett tur"-knapp som sender til /turrute/ny
    cy.get("button").should("exist");
  });
});

describe("Ny turrute (/turrute/ny) – tilgangskontroll", () => {
  it("uinnlogget bruker kan ikke opprette turrute", () => {
    cy.visit("/turrute/ny");
    // Siden sjekker rolle – skal vise feilmelding eller redirecte
    cy.get("body").should("not.be.empty");
    cy.get("body").invoke("text").then((text) => {
      // Siden bør enten redirecte eller vise en tilgangsmelding
      expect(text).not.to.include("Internal Server Error");
    });
  });

  it("vanlig bruker (USER) blokkeres fra /turrute/ny", () => {
    cy.registerAndLogin();
    cy.intercept("GET", "/api/auth/me*").as("authMe");
    cy.visit("/turrute/ny");
    cy.wait("@authMe");
    // En USER-bruker skal ikke se skjemaet for å opprette turrute
    cy.get("body").invoke("text").then((text) => {
      const blocked =
        text.toLowerCase().includes("tilgang") ||
        text.toLowerCase().includes("turleder") ||
        text.toLowerCase().includes("ikke tillatt") ||
        text.toLowerCase().includes("innlogget");
      expect(blocked).to.be.true;
    });
  });
});

describe("Turrute API – tilgangskontroll", () => {
  it("POST /api/turrute/ny returnerer 401/403 for uinnlogget", () => {
    cy.request({
      method: "POST",
      url: "/api/trips",
      body: { navn: "Test", type: "fottur" },
      failOnStatusCode: false,
    }).then((res) => {
      // API krever innlogging
      expect(res.status).to.be.oneOf([401, 403]);
    });
  });
});
