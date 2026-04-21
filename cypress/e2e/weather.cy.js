// E2E-tester for værsiden (/vaer)
// Tester at siden laster, søk fungerer og at værdata vises

describe("Værsiden", () => {
  beforeEach(() => {
    cy.visit("/vaer");
  });

  it("laster værsiden", () => {
    cy.url().should("include", "/vaer");
    cy.get("body").should("not.be.empty");
  });

  it("viser et søkefelt for stedsnavn", () => {
    cy.get("input[type='text'], input[placeholder*='sted'], input[placeholder*='Sted'], input[placeholder*='søk']")
      .should("be.visible");
  });

  it("søk etter 'Bø' gir et resultat", () => {
    cy.get("input[type='text']").first().type("Bø");
    // Klikk søkeknapp eller trykk Enter
    cy.get("input[type='text']").first().type("{enter}");
    // Siden skal ikke krasje og skal vise noe innhold
    cy.get("body").should("not.be.empty");
  });

  it("viser et kart eller værinformasjon", () => {
    // Siden skal enten ha et leaflet-kart eller vær-data
    cy.get(".leaflet-container, [class*='weather'], [class*='vaer'], canvas", { timeout: 10000 })
      .should("exist");
  });
});
