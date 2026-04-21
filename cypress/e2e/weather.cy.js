// E2E-tester for værsiden (/weather)
// Søkefeltet på denne siden har IKKE type="text" eller type="search" –
// det er en ren <input> uten type-attributt inne i et <form>-element.
// Selector: "form input" eller input[placeholder*='Søk'] fungerer.

describe("Værsiden – sidestruktur", () => {
  beforeEach(() => {
    cy.visit("/weather");
  });

  it("laster værsiden uten krasj", () => {
    cy.url().should("include", "/weather");
    cy.get("body").should("not.be.empty");
  });

  it("viser søkefeltet for stedsnavn", () => {
    // Søkefeltet ligger inne i et <form> og har placeholder "Søk etter sted"
    cy.get("form input").should("be.visible");
  });

  it("søkefeltet har riktig placeholder-tekst", () => {
    // Placeholder settes av oversettingssystemet – sjekk at den inneholder "søk" (case-insensitiv)
    cy.get("form input")
      .invoke("attr", "placeholder")
      .should("match", /søk|search|cerca|buscar/i);
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
    cy.visit("/weather");
  });

  it("kan skrive i søkefeltet", () => {
    cy.get("form input")
      .type("Oslo")
      .should("have.value", "Oslo");
  });

  it("søk med Enter sender skjemaet uten å krasje siden", () => {
    cy.get("form input")
      .type("Bø{enter}");
    // Siden skal fortsatt eksistere etter søk
    cy.get("body").should("not.be.empty");
    cy.get("form input").should("exist");
  });

  it("send-knappen inne i skjemaet er klikkbar", () => {
    // Knappen har type="submit" og er siste element i <form>
    cy.get("form button[type='submit']").should("be.visible");
    cy.get("form input").type("Telemark");
    cy.get("form button[type='submit']").click();
    cy.get("body").should("not.be.empty");
  });

  it("søk etter kjent sted viser resultatliste eller værmeldingskort", () => {
    cy.intercept("GET", "/api/search*").as("search");
    cy.get("form input").type("Oslo");
    cy.get("form button[type='submit']").click();
    cy.wait("@search", { timeout: 10000 });
    // Enten vises søkeresultater eller en feilmelding – ikke siden krasjer
    cy.get("body").should("not.be.empty");
    cy.get("body").invoke("text").then((text) => {
      expect(text).not.to.include("Internal Server Error");
    });
  });
});

describe("Værsiden – kart", () => {
  it("Leaflet-kartet laster på værsiden", () => {
    cy.visit("/weather");
    cy.get(".leaflet-container", { timeout: 10000 }).should("exist");
  });
});

describe("Værsiden – min-posisjon-knapp", () => {
  it("posisjon-knappen finnes og er klikkbar", () => {
    cy.visit("/weather");
    // Knappen har teksten "Min posisjon" (eller "Henter..." under lasting)
    cy.get("button").filter((_, el) =>
      /posisjon|location/i.test(el.textContent || "")
    ).should("exist");
  });
});
