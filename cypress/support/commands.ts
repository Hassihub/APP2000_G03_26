/// <reference types="cypress" />

// cy.login(email, password)
// Logger inn via UI og venter til redirect er ferdig
Cypress.Commands.add("login", (email: string, password: string) => {
  cy.visit("/login");
  cy.get("[data-cy=login-email]").type(email);
  cy.get("[data-cy=login-password]").type(password);
  cy.get("[data-cy=login-submit]").click();
  // Vent på at siden navigerer bort fra /login
  cy.url({ timeout: 10000 }).should("not.include", "/login");
});

// cy.loginByApi(email, password)
// Logger inn direkte via API – raskere, ingen UI
Cypress.Commands.add("loginByApi", (email: string, password: string) => {
  cy.request({
    method: "POST",
    url: "/api/auth/login",
    body: { email, password },
    failOnStatusCode: false,
  }).then((res) => {
    expect(res.status).to.eq(200);
  });
});

declare global {
  namespace Cypress {
    interface Chainable {
      login(email: string, password: string): Chainable<void>;
      loginByApi(email: string, password: string): Chainable<void>;
    }
  }
}
