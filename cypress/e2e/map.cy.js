// Tester kartsiden
describe("Kart", () => {
  beforeEach(() => {
    // Stub geolocation slik at Cypress ikke henger på tillatelsesdialog
    cy.visit("/map", {
      onBeforeLoad(win) {
        cy.stub(win.navigator.geolocation, "getCurrentPosition").callsFake((success) => {
          success({
            coords: {
              latitude: 59.9139,
              longitude: 10.7522,
              accuracy: 50,
            },
          });
        });
      },
    });
  });

  it("laster kartsiden", () => {
    cy.url().should("include", "/map");
    cy.get("body").should("not.be.empty");
  });

  it("viser venstre kontrollpanel", () => {
    // Panelet med knapper og toggles skal være synlig
    cy.contains("Min posisjon").should("be.visible");
    cy.contains("Plasser punkt").should("be.visible");
    cy.contains("Vis hytter").should("be.visible");
    cy.contains("Vis turer").should("be.visible");
  });

  it("viser Leaflet-kartbeholderen", () => {
    cy.get("#map").should("exist");
    // Leaflet setter klassen leaflet-container på sin root-div
    cy.get(".leaflet-container", { timeout: 8000 }).should("be.visible");
  });

  it("knappen Min posisjon er klikkbar", () => {
    cy.contains("Min posisjon").should("be.visible").click();
    // Kartet skal ikke krasje etter klikk
    cy.get(".leaflet-container").should("exist");
  });

  it("kan slå på og av Vis hytter", () => {
    cy.contains("Vis hytter").parent().find("input[type=checkbox]").check();
    cy.contains("Vis hytter").parent().find("input[type=checkbox]").should("be.checked");
    cy.contains("Vis hytter").parent().find("input[type=checkbox]").uncheck();
    cy.contains("Vis hytter").parent().find("input[type=checkbox]").should("not.be.checked");
  });
});
