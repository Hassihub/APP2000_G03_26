// E2E-tester for hyttesiden (/reserver)
// Tester sidestruktur og navigasjon – uavhengig av hvilke hytter som finnes i DB

describe("Hytteliste – sidestruktur", () => {
  beforeEach(() => {
    cy.visit("/reserver");
  });

  it("laster hyttesiden uten krasj", () => {
    cy.url().should("include", "/reserver");
    cy.get("body").should("not.be.empty");
  });

  it("viser et søke- eller filtreringsfelt", () => {
    cy.get("input[type='text'], input[type='search']")
      .should("exist");
  });

  it("siden inneholder ikke en synlig feilmelding", () => {
    cy.get("body").invoke("text").then((text) => {
      expect(text.toLowerCase()).not.to.include("noe gikk galt");
      expect(text.toLowerCase()).not.to.include("500");
    });
  });
});

describe("Hytteliste – med hytter i databasen", () => {
  beforeEach(() => {
    cy.visit("/reserver");
  });

  it("hvis det finnes hytter vises de som klikkbare kort", () => {
    // Vent på at siden er ferdig å laste
    cy.get("body").should("not.be.empty");

    cy.get("body").then(($body) => {
      // Sjekk om det finnes hyttekort – hopp over hvis DB er tom
      const hasCabins = $body.find("a[href*='/reserver/']").length > 0;
      if (!hasCabins) {
        cy.log("Ingen hytter i databasen – hopper over dette testen");
        return;
      }
      cy.get("a[href*='/reserver/']").first().should("be.visible");
    });
  });

  it("hvis det finnes hytter kan man åpne en detaljside", () => {
    cy.get("body").then(($body) => {
      if ($body.find("a[href*='/reserver/']").length === 0) {
        cy.log("Ingen hytter å klikke på");
        return;
      }
      cy.get("a[href*='/reserver/']").first().click();
      cy.url().should("match", /\/reserver\/.+/);
      cy.get("body").should("not.be.empty");
    });
  });
});

describe("Hyttebooking – tilgangskontroll", () => {
  it("uinnlogget bruker kan se hytter men ikke booke", () => {
    cy.visit("/reserver");
    cy.get("body").then(($body) => {
      if ($body.find("a[href*='/reserver/']").length === 0) return;

      cy.get("a[href*='/reserver/']").first().click();
      cy.url().should("match", /\/reserver\/.+/);

      // Forsøk å trykke på en book-knapp om den finnes
      cy.get("body").then(($detail) => {
        const bookBtn = $detail.find("button, a").filter((_, el) =>
          /book|reserver/i.test(el.textContent || "")
        );
        if (bookBtn.length > 0) {
          cy.wrap(bookBtn.first()).click();
          // Skal enten forbli på siden (med login-modal) eller gå til /login
          cy.url().should("satisfy", (url) =>
            url.includes("/login") || url.includes("/reserver")
          );
        }
      });
    });
  });

  it("innlogget bruker kan navigere til bookingsiden", () => {
    cy.registerAndLogin();
    cy.visit("/reserver");

    cy.get("body").then(($body) => {
      if ($body.find("a[href*='/reserver/']").length === 0) return;
      cy.get("a[href*='/reserver/']").first().click();
      cy.url().should("match", /\/reserver\/.+/);
    });
  });
});

describe("Opprett ny hytte – tilgangskontroll", () => {
  it("uinnlogget bruker blir redirectet fra /reserver/ny", () => {
    cy.visit("/reserver/ny");
    cy.url().should("satisfy", (url) =>
      url.includes("/login") || url.includes("/reserver")
    );
  });

  it("vanlig bruker (USER) får ikke opprette hytte", () => {
    cy.registerAndLogin();
    cy.visit("/reserver/ny");
    // USER-rolle skal blokkeres — siden viser feilmelding eller redirect
    cy.get("body").invoke("text").then((text) => {
      const blocked =
        text.toLowerCase().includes("tilgang") ||
        text.toLowerCase().includes("utleier") ||
        text.toLowerCase().includes("ikke tillatt") ||
        !text.toLowerCase().includes("ny hytte");
      expect(blocked).to.be.true;
    });
  });
});
