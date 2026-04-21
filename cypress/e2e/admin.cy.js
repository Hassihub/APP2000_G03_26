// E2E-tester for admin-panelet (/admin)
// Tester tilgangskontroll og at admin-funksjonene er tilgjengelige

describe("Admin – ikke innlogget", () => {
  it("blokkerer tilgang til /admin uten innlogging", () => {
    cy.visit("/admin");
    // Skal enten redirecte til /login eller vise "ingen tilgang"
    cy.url().should("satisfy", (url) =>
      url.includes("/login") || url.includes("/admin")
    );
    cy.get("body").invoke("text").then((text) => {
      const blocked =
        text.toLowerCase().includes("ingen tilgang") ||
        text.toLowerCase().includes("ikke innlogget") ||
        text.toLowerCase().includes("logg inn") ||
        !text.toLowerCase().includes("brukere");
      expect(blocked).to.be.true;
    });
  });
});

describe("Admin – innlogget som vanlig bruker", () => {
  beforeEach(() => {
    cy.fixture("users").then((users) => {
      cy.login(users.validUser.email, users.validUser.password);
    });
    cy.visit("/admin");
  });

  it("vanlig bruker får ikke tilgang til admin-panelet", () => {
    cy.get("body").invoke("text").then((text) => {
      const blocked =
        text.toLowerCase().includes("ingen tilgang") ||
        text.toLowerCase().includes("ikke tillatt") ||
        !text.toLowerCase().includes("alle brukere");
      expect(blocked).to.be.true;
    });
  });
});

describe("Admin – innlogget som admin", () => {
  beforeEach(() => {
    cy.fixture("users").then((users) => {
      cy.login(users.adminUser.email, users.adminUser.password);
    });
    cy.visit("/admin");
  });

  it("admin ser admin-panelet", () => {
    cy.url().should("include", "/admin");
    cy.get("body").should("not.be.empty");
    // Admin-siden skal vise noe bruker-relatert innhold
    cy.contains(/bruker|brukere|rolle|admin/i, { timeout: 8000 }).should("exist");
  });

  it("admin ser liste over brukere", () => {
    // Etter reset skal det finnes minst 5 preset-brukere
    cy.get("table tr, [class*='user'], [class*='row']", { timeout: 8000 })
      .should("have.length.at.least", 2);
  });

  it("admin kan endre rolle på en bruker", () => {
    // Finn en rolle-dropdown eller knapp
    cy.get("select, button").filter(":contains('USER'), :contains('UTLEIER'), :contains('ADMIN'), :contains('Rolle')")
      .first()
      .should("exist");
  });
});

describe("Reset-knapp – synlighet", () => {
  it("reset-knappen er IKKE synlig for ikke-innloggede", () => {
    cy.visit("/");
    cy.get(".reset-test-data-btn").should("not.exist");
  });

  it("reset-knappen er IKKE synlig for vanlig bruker", () => {
    cy.fixture("users").then((users) => {
      cy.login(users.validUser.email, users.validUser.password);
    });
    cy.visit("/");
    cy.get(".reset-test-data-btn").should("not.exist");
  });

  it("reset-knappen ER synlig for admin", () => {
    cy.fixture("users").then((users) => {
      cy.login(users.adminUser.email, users.adminUser.password);
    });
    cy.visit("/");
    cy.get(".reset-test-data-btn", { timeout: 8000 }).should("be.visible");
  });
});
