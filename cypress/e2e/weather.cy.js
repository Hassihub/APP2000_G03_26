// E2E-tester for værsiden (/vaer)
// Ingen datavhengighet – tester kun sidestruktur og funksjonalitet

describe("Værsiden – sidestruktur", () => {
  beforeEach(() => {
    cy.visit("/vaer");
  });

  it("laster værsiden uten krasj", () => {
    cy.url().should("include", "/vaer");
    cy.get("body").should("not.be.empty");
  });

  it("viser et søkefelt for å søke etter sted", () => {
    cy.get("input[type='text'], input[type='search']")
      .first()
      .should("be.visible");
  });

  it("siden har ingen synlig 500-feil", () => {
    cy.get("body").invoke("text").then((text) => {
      expect(text).not.to.include("Internal Server Error");
      expect(text).not.to.include("Application error");
    });
  });
});

describe("Værsiden – søkefunksjonalitet", () => {
  beforeEach(() => {
    cy.visit("/vaer");
  });

  it("kan skrive i søkefeltet", () => {
    cy.get("input[type='text'], input[type='search']")
      .first()
      .type("Oslo")
      .should("have.value", "Oslo");
  });

  it("søk med Enter krasjer ikke siden", () => {
    cy.get("input[type='text'], input[type='search']")
      .first()
      .type("Bø{enter}");
    cy.get("body").should("not.be.empty");
  });

  it("søkknapp er klikkbar hvis den finnes", () => {
    cy.get("body").then(($body) => {
      const hasBtn = $body.find("button[type='submit'], button").filter((_, el) =>
        /søk|search|finn/i.test(el.textContent || "")
      ).length > 0;

      if (hasBtn) {
        cy.get("input[type='text']").first().type("Telemark");
        cy.get("button[type='submit'], button").filter((_, el) =>
          /søk|search|finn/i.test(el.textContent || "")
        ).first().click();
        cy.get("body").should("not.be.empty");
      }
    });
  });
});

describe("Værsiden – kart", () => {
  it("Leaflet-kartet laster", () => {
    cy.visit("/vaer");
    cy.get(".leaflet-container", { timeout: 10000 }).should("exist");
  });
});
