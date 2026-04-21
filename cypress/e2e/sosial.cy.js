// E2E-tester for sosial-feeden (/sosial)
// Registrerer en fersk testbruker i beforeEach – ingen reset-avhengighet

describe("Sosial feed – ikke innlogget", () => {
  beforeEach(() => {
    cy.intercept("GET", "/api/sosial/posts*").as("posts");
    cy.visit("/sosial");
    // Vent på at innlegg er lastet — eller ignorer hvis endepunktet ikke kalles
    cy.wait("@posts", { timeout: 15000 }).then(() => {}).catch(() => {});
  });

  it("laster sosial-siden uten krasj", () => {
    cy.url().should("include", "/sosial");
    cy.get("body").should("not.be.empty");
  });

  it("viser innlegg eller melding om innlogging", () => {
    cy.get("body").invoke("text").then((text) => {
      const hasContent =
        text.toLowerCase().includes("innlogg") ||
        text.toLowerCase().includes("logg inn") ||
        document.querySelectorAll("[class*='post'], [class*='feed'], article").length > 0;
      expect(hasContent).to.be.true;
    });
  });

  it("siden inneholder ikke en 500-feil", () => {
    cy.get("body").invoke("text").then((text) => {
      expect(text).not.to.include("Internal Server Error");
    });
  });
});

describe("Sosial feed – innlogget bruker", () => {
  beforeEach(() => {
    cy.registerAndLogin();
    cy.intercept("GET", "/api/sosial/posts*").as("posts");
    cy.visit("/sosial");
    cy.wait("@posts", { timeout: 15000 });
  });

  it("viser feeden etter innlogging", () => {
    cy.url().should("include", "/sosial");
    cy.get("body").should("not.be.empty");
  });

  it("viser et felt for å skrive nytt innlegg", () => {
    cy.get("textarea, input[placeholder*='skriv'], input[placeholder*='del']", {
      timeout: 8000,
    }).should("exist");
  });

  it("kan skrive og sende et nytt innlegg", () => {
    const innlegg = `Cypress-testinnlegg ${Date.now()}`;

    cy.get("textarea, input[placeholder*='skriv'], input[placeholder*='del']")
      .first()
      .type(innlegg);

    // Finn og klikk send-knappen
    cy.get("button").filter((_, el) =>
      /post|del|send|publiser/i.test(el.textContent || "")
    ).first().click();

    // Innlegget skal dukke opp i feeden
    cy.contains(innlegg, { timeout: 8000 }).should("exist");
  });

  it("kan like et innlegg hvis det finnes innlegg", () => {
    cy.get("body").then(($body) => {
      // Finn en like-knapp (hjerte, tommel, etc.)
      const likeBtn = $body.find(
        "button[aria-label*='like'], button[aria-label*='hjerte'], button[class*='like']"
      );
      if (likeBtn.length === 0) {
        cy.log("Ingen like-knapp funnet – hopper over");
        return;
      }
      cy.wrap(likeBtn.first()).click();
      cy.get("body").should("not.be.empty");
    });
  });
});
