// Tester registreringssiden
describe("Registrering", () => {
  beforeEach(() => {
    cy.visit("/signup");
  });

  it("viser signup-skjemaet", () => {
    cy.get("[data-cy=signup-username]").should("be.visible");
    cy.get("[data-cy=signup-email]").should("be.visible");
    cy.get("[data-cy=signup-password]").should("be.visible");
    cy.get("[data-cy=signup-confirm-password]").should("be.visible");
    cy.get("[data-cy=signup-submit]").should("be.visible");
  });

  it("viser feilmelding hvis passordene ikke matcher", () => {
    cy.get("[data-cy=signup-username]").type("testbruker");
    cy.get("[data-cy=signup-email]").type("ny@frittfram.no");
    cy.get("[data-cy=signup-password]").type("Passord123!");
    cy.get("[data-cy=signup-confirm-password]").type("AnnetPassord999!");
    cy.get("[data-cy=signup-submit]").click();
    cy.url().should("include", "/signup");
    cy.contains("Passordene er ikke like").should("be.visible");
  });

  it("har en lenke til login-siden", () => {
    cy.get('a[href*="login"]').first().click();
    cy.url().should("include", "/login");
  });
});
