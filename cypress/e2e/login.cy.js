// Tester innloggingssiden
describe("Innlogging", () => {
  beforeEach(() => {
    cy.visit("/login");
  });

  it("viser login-skjemaet", () => {
    cy.get("[data-cy=login-email]").should("be.visible");
    cy.get("[data-cy=login-password]").should("be.visible");
    cy.get("[data-cy=login-submit]").should("be.visible");
  });

  it("viser feilmelding ved feil e-post eller passord", () => {
    cy.fixture("users").then((users) => {
      cy.get("[data-cy=login-email]").type(users.invalidUser.email);
      cy.get("[data-cy=login-password]").type(users.invalidUser.password);
      cy.get("[data-cy=login-submit]").click();
      // Skal forbli på /login og vise "Feil e-post eller passord"
      cy.url().should("include", "/login");
      cy.contains("Feil e-post eller passord").should("be.visible");
    });
  });

  it("logger inn med riktig brukernavn og passord", () => {
    cy.fixture("users").then((users) => {
      cy.get("[data-cy=login-email]").type(users.validUser.email);
      cy.get("[data-cy=login-password]").type(users.validUser.password);
      cy.get("[data-cy=login-submit]").click();
      // window.location.assign("/") gjør full reload — Cypress følger dette
      cy.url({ timeout: 10000 }).should("not.include", "/login");
    });
  });

  it("har en lenke til signup-siden", () => {
    cy.get('a[href*="signup"]').first().click();
    cy.url().should("include", "/signup");
  });
});
