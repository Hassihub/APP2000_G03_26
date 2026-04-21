// E2E-tester for sosial-feeden (/sosial)
// Tester at feeden laster og at innloggede brukere kan legge ut innlegg

describe("Sosial feed – ikke innlogget", () => {
  beforeEach(() => {
    cy.visit("/sosial");
  });

  it("laster sosial-siden", () => {
    cy.url().should("include", "/sosial");
    cy.get("body").should("not.be.empty");
  });

  it("viser innleggslisten eller en melding om at man må logge inn", () => {
    // Enten vises innlegg, eller en oppfordring om å logge inn
    cy.get("body").should("satisfy", ($body) => {
      const text = $body.text();
      return (
        text.includes("innlogg") ||
        text.includes("logg inn") ||
        text.includes("Logg inn") ||
        $body.find("[class*='post'], [class*='feed'], article").length > 0
      );
    });
  });
});

describe("Sosial feed – innlogget bruker", () => {
  beforeEach(() => {
    cy.fixture("users").then((users) => {
      cy.login(users.validUser.email, users.validUser.password);
    });
    cy.visit("/sosial");
  });

  it("viser feeden når man er innlogget", () => {
    cy.url().should("include", "/sosial");
    cy.get("body").should("not.be.empty");
  });

  it("viser et felt for å skrive nytt innlegg", () => {
    // Det skal finnes et tekstfelt eller knapp for å opprette innlegg
    cy.get(
      "textarea, input[placeholder*='innlegg'], input[placeholder*='skriv'], button[class*='post']",
      { timeout: 8000 }
    ).should("exist");
  });

  it("kan legge ut et nytt innlegg", () => {
    cy.get("textarea, input[placeholder*='innlegg'], input[placeholder*='skriv']")
      .first()
      .type("Testinnlegg fra Cypress");

    cy.get("button[type='submit'], button").filter(":contains('Post'), :contains('Del'), :contains('Send')")
      .first()
      .click();

    // Innlegget skal dukke opp i feeden
    cy.contains("Testinnlegg fra Cypress", { timeout: 8000 }).should("exist");
  });
});
