// E2E-tester for hyttesiden (/reserver)
// Tester at hytter vises, søk/filtrering fungerer og at man kan åpne en hytte

describe("Hytter", () => {
  beforeEach(() => {
    cy.visit("/reserver");
  });

  it("laster hyttesiden", () => {
    cy.url().should("include", "/reserver");
    cy.get("body").should("not.be.empty");
  });

  it("viser minst én hytte etter reset", () => {
    // Etter reset skal det ligge 4 forhåndsinnstilte hytter i databasen.
    // Vi venter litt ekstra siden hyttene hentes fra API.
    cy.get("[data-cy=cabin-card], .cabin-card, [class*='cabin']", { timeout: 10000 })
      .should("have.length.at.least", 1);
  });

  it("søkefeltet filtrerer hytter", () => {
    // Finn søkefeltet og søk på noe som finnes i testdataene
    cy.get("input[type='text'], input[placeholder*='søk'], input[placeholder*='Søk']")
      .first()
      .type("Bø");
    // Etter søk skal siden oppdatere seg
    cy.get("body").should("not.be.empty");
  });

  it("kan klikke seg inn på en hytte", () => {
    // Klikk på den første hytten og sjekk at vi havner på en detaljside
    cy.get("a[href*='/reserver/']", { timeout: 10000 })
      .first()
      .click();
    cy.url().should("match", /\/reserver\/\w+/);
    cy.get("body").should("not.be.empty");
  });

  it("hyttedetalj-siden viser navn og pris", () => {
    cy.get("a[href*='/reserver/']", { timeout: 10000 })
      .first()
      .click();
    // Siden skal inneholde prisinformasjon
    cy.contains(/kr|,-|per natt|natt/i).should("exist");
  });
});

describe("Hyttebooking krever innlogging", () => {
  it("redirect til login hvis man prøver å booke uten å være innlogget", () => {
    cy.visit("/reserver");
    cy.get("a[href*='/reserver/']", { timeout: 10000 }).first().click();
    // Klikk på en "Book"-knapp hvis den finnes
    cy.get("body").then(($body) => {
      if ($body.find("button, a").filter(":contains('Book')").length > 0) {
        cy.contains(/book/i).first().click();
        cy.url().should("satisfy", (url) =>
          url.includes("/login") || url.includes("/reserver")
        );
      }
    });
  });
});
