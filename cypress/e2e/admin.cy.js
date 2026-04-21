// E2E-tester for admin-panelet (/admin)
// Tester tilgangskontroll – ingen reset-avhengighet

describe("Admin – ikke innlogget", () => {
  it("uinnlogget bruker blokkeres fra /admin", () => {
    cy.visit("/admin");
    cy.url().should("satisfy", (url) =>
      url.includes("/login") || url.includes("/admin")
    );
    cy.get("body").invoke("text").then((text) => {
      const blocked =
        text.toLowerCase().includes("ingen tilgang") ||
        text.toLowerCase().includes("ikke innlogget") ||
        text.toLowerCase().includes("logg inn") ||
        !text.toLowerCase().includes("alle brukere");
      expect(blocked).to.be.true;
    });
  });
});

describe("Admin – innlogget som vanlig bruker", () => {
  beforeEach(() => {
    // Registrer en fersk USER-bruker
    cy.registerAndLogin();
    cy.visit("/admin");
  });

  it("vanlig bruker (USER) blokkeres fra admin-panelet", () => {
    cy.get("body").invoke("text").then((text) => {
      const blocked =
        text.toLowerCase().includes("ingen tilgang") ||
        text.toLowerCase().includes("ikke tillatt") ||
        text.toLowerCase().includes("admin") && !text.toLowerCase().includes("alle brukere");
      expect(blocked).to.be.true;
    });
  });
});

describe("Navigasjonslenker – synlighet for innlogget bruker", () => {
  it("innlogget bruker ser ikke admin-lenke i navigasjonen", () => {
    cy.registerAndLogin();
    cy.visit("/");
    // Navigasjonen skal ikke eksponere /admin for vanlige brukere
    cy.get("a[href='/admin']").should("not.exist");
  });
});

describe("Reset-knapp – synlighet", () => {
  it("reset-knappen vises IKKE for uinnlogget besøkende", () => {
    cy.visit("/");
    cy.get(".reset-test-data-btn").should("not.exist");
  });

  it("reset-knappen vises IKKE for vanlig bruker (USER)", () => {
    cy.registerAndLogin();
    cy.visit("/");
    // Vent på at /api/auth/me er ferdig lastet (banneret sjekker dette)
    cy.wait(2000);
    cy.get(".reset-test-data-btn").should("not.exist");
  });
});

describe("Admin API – tilgangskontroll", () => {
  it("GET /api/auth/users returnerer 401 for uinnlogget", () => {
    cy.request({
      method: "GET",
      url: "/api/auth/users",
      failOnStatusCode: false,
    }).then((res) => {
      expect(res.status).to.be.oneOf([401, 403]);
    });
  });

  it("POST /api/admin/reset-test-data returnerer 403 for uinnlogget", () => {
    cy.request({
      method: "POST",
      url: "/api/admin/reset-test-data",
      failOnStatusCode: false,
    }).then((res) => {
      expect(res.status).to.be.oneOf([401, 403]);
    });
  });

  it("POST /api/admin/reset-test-data returnerer 403 for vanlig bruker", () => {
    cy.registerAndLogin();
    cy.request({
      method: "POST",
      url: "/api/admin/reset-test-data",
      failOnStatusCode: false,
    }).then((res) => {
      expect(res.status).to.eq(403);
    });
  });
});
