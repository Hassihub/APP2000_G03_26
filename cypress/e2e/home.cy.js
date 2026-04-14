// Tester hjemmesiden
describe("Hjemmeside", () => {
  beforeEach(() => {
    cy.visit("/");
  });

  it("laster hjemmesiden", () => {
    cy.url().should("eq", Cypress.config("baseUrl") + "/");
    cy.get("body").should("not.be.empty");
  });

  it("viser hero-seksjonen med søkefelt", () => {
    cy.get("#hero-section").should("exist");
    cy.get('input[type="text"]').should("be.visible");
  });

  it("søk navigerer til /search", () => {
    cy.get('input[type="text"]').first().type("Jotunheimen");
    cy.get('button[type="submit"]').first().click();
    cy.url({ timeout: 8000 }).should("include", "/search");
    cy.url().should("include", "Jotunheimen");
  });

  it("kategorilenker er synlige", () => {
    cy.get('a[href="/map"]').should("exist");
    cy.get('a[href="/explore"]').should("exist");
    cy.get('a[href="/vaer"]').should("exist");
  });
});
